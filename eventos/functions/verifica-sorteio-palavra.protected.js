const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();

/*
    event: evento, palavra
*/
exports.handler = async function(context, event, callback) {

    // TODO: verificar se palavra-chave existe
    // TODO: retornar status e totais
    event.palavra = event.palavra.toLowerCase();

    // let participanteId = await md5(limpaNumero(event.from));
    const sorteio = await firestore.collection('events')
        .doc(event.evento).collection('sorteios')
        .doc(event.palavra)
        .get().then(e => {
            if (!e.exists) {
                return null
            }
            return e.data();
        });

    // let participanteGeral = await firestore.collection('participantes')
    //     .doc(participanteId).get().then(async s => {
    //         if (s.exists) {
    //             return s.data();
    //         } else {
    //             return {}
    //         }
    // });
    const valida = sorteio != null;

    let mensagem = [];
    mensagem.push(`*${event.palavra.toUpperCase()}*`);
    // mensagem.push(``);

    if (sorteio) {
        const inscricoes = await firestore.collection('events')
            .doc(event.evento).collection('sorteios')
            .doc(event.palavra).collection('participantes')
            .get().then(s => s.size);

        const sorteados = await firestore.collection('events')
            .doc(event.evento).collection('sorteios')
            .doc(event.palavra).collection('participantes')
            .where('sorteado', '==', true)
            .get().then(s => s.size);

        mensagem.push([
            `Status: ${sorteio.status ? sorteio.status.toUpperCase() : 'PENDENTE' }`,
            `Inscrições: ${inscricoes}`,
            `Pessoas sorteadas: ${sorteados}`,
        ].join('\n'));

        mensagem.push([
            `O que deseja fazer?`,
            `SORTEAR, ${sorteio.status == 'aberto' ? 'FECHAR' : 'ABRIR'}, LISTA, SAIR`
        ].join('\n'));
            
    } else {
        mensagem.push(`ESTA PALAVRA-CHAVE DE SORTEIO NÃO EXISTE!`);
    }


    // *{{widgets.palavra.inbound.Body | upcase}}* 

    // Status: SORTEIO ABERTO
    // Inscrições: 0
    // Pessoas Sorteadas: 0

    // O que deseja fazer?
    // SORTEAR, ABRIR/FECHAR, SAIR
    

    let data = {
        valida,
        mensagem: mensagem.join('\n\n')
    };

    callback(null, data);
};
