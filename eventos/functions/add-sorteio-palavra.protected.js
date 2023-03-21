const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();
const md5 = require('md5');

/*
    event: evento, palavra, from
*/
exports.handler = async function(context, event, callback) {

    let participanteId = await md5(limpaNumero(event.from));
    let idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    event.palavra = event.palavra.toLowerCase();

    let mensagem = [];

    const sorteio = await firestore.collection('events')
            .doc(event.evento).collection('sorteios')
            .doc(event.palavra)
            .get().then(p => {
                if (p.exists) {
                    return p.data()
                }
                return null
            });

    if (sorteio) {

        // Verificar se sorteio esta aberto
        if (sorteio.status == 'aberto') {
            const inscrito = await firestore.collection('events')
                    .doc(event.evento).collection('sorteios')
                    .doc(event.palavra).collection('participantes')
                    .doc(idPlayerEvent)
                    .get().then(p => p.exists);

            if (!inscrito) {
                // Inscrever

                let participante = await firestore.collection('events')
                    .doc(event.evento).collection('participantes')
                    .doc(idPlayerEvent).get().then(async s => {
                        if (s.exists) {
                            return s.data();
                        } 
                        return {
                            nome: 'Sem nome informado'
                        }
                });

                await firestore.collection('events')
                    .doc(event.evento).collection('sorteios')
                    .doc(event.palavra).collection('participantes')
                    .doc(idPlayerEvent)
                    .set({
                        participanteId,
                        idPlayerEvent,
                        telefone: escondeNumero(limpaNumero(event.from)),
                        nome: participante.nome || '',
                        profileName: participante.profileName,
                        sorteado: false,
                        seed: Math.random(),
                        createdAt: admin.firestore.FieldValue.serverTimestamp(),                        
                    }, { merge: true });

                await firestore.collection('events')
                    .doc(event.evento).collection('sorteios')
                    .doc(event.palavra).set({ 
                        inscricoes: admin.firestore.FieldValue.increment(1)
                    }, { merge: true});

                const nomeSorteio = sorteio.nome || '';
                mensagem.push(`🥳 🎉 Inscrição realizada com sucesso para o sorteio *${nomeSorteio.split('<e>').join('\n')}*! 🎉`);

            } else {
                // Não deixar inscrever
                mensagem.push(`Você já fez sua inscrição para este sorteio!`);
            }

        } else {
            mensagem.push(`O sorteio informado não está aberto.`);
        }

    } else {
        mensagem.push(`Palavra-chave de sorteio não foi encontrada!`);
    }

    let data = {
        mensagem: mensagem.join('\n\n')
    };

    callback(null, data);
};
