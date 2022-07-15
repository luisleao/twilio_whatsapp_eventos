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
    event: evento, token, from
*/
exports.handler = async function(context, event, callback) {
    let participanteId = await md5(limpaNumero(event.from));

    console.log('VERIFICA PALAVRA: ', event);

    const client = await context.getTwilioClient();
    if (!event.token) {
        console.log('TOKEN VAZIO');
        return callback(null, {
            type: 'not-found'
        });
    }

    let activation = await firestore.collection('events').doc(event.evento).collection('palavras').doc(event.token).get();
    if (!activation.exists) {
        activation = await firestore.collection('events').doc(event.evento).collection('palavras').doc(event.token.toLowerCase()).get();
        if (!activation.exists) {
            // token não encontrado
            console.log(event.token, 'Palavra não existe no evento', event.evento);
            return callback(null, {
                type: 'not-found'
            });
        }
    }

    let activationData = activation.data();
    if (activationData.mensagem) {
      activationData.mensagem = convertNewLine(activationData.mensagem);
    }
    let callbackData = {
        ...activationData
        // type: activationData.type || 'activation',
    }

    switch(activationData.type) {
        case 'impressao_manual':
            break;

        case 'reimpressao':
            break;

        case 'impressao':
            // Carregar dados de participante
            let participante = await firestore.collection('events').doc(event.evento).collection('participantes')
                .doc(participanteId)
                .get()
                .then( p => p.exists ? p.data() : null );
    
            if (!participante) {
                // Verificar se tem dado do participante geral e copiar
                const participanteGeral = await firestore.collection('participantes')
                    .doc(participanteId)
                    .get()
                    .then( p => p.exists ? p.data() : null );

                if (!participanteGeral) {
                    // Erro: participante não encontrato no evento!
                    return callback(null, {
                        type: activationData.type,
                        mensagem: 'Erro!\n\nParticipante não encontrado neste evento.'
                    });
                }
                participante = participanteGeral;
            }

            await firestore.collection('labels').add({
                evento: event.evento,
                printer: activationData.printer,
                participanteId,
                ...participante
            });

            await firestore.collection('printers').doc(activationData.printer).set({
                impressoes: admin.firestore.FieldValue.increment(1),
                updatedAt: admin.firestore.FieldValue.serverTimestamp()
            }, { merge: true });

            if (activationData.mediaUrl) {
                activationData.mediaUrl = fillParams(activationData.mediaUrl, {
                    participanteId,
                    ...participante
                });
            }
            break;

        case 'quiz':
            break;

        case 'certificado':
            break;

        default: // 'conteudo'
            break;
    }
  
    // tipos de palavras-chave
    // TODO: impressao
    // TODO: quiz
    // TODO: certificado
    // TODO: conteudo

    // TODO: networking (registro linkedin)
    // TODO: voucher
    // TODO: score

    // TODO: limite máximo de ativações
    // TODO: notificações

    // Uma nova pessoa que acabou de se conectar com você: {{1}}



    // event.evento, event.token

    // let participanteId = await md5(limpaNumero(event.from));

    // let evento = null;
    // let mensagem = '';
    // let mediaUrl = '';

    // console.log('participanteId', participanteId);

    // const participante = await firestore.collection('participantes')
    //     .doc(participanteId)
    //     .get()
    //     .then( p => p.exists ? p.data() : null );

    // if (participante) {
    //     evento = participante.evento || null;
    //     // Verificar se evento estiver ativo
    //     if (evento != null) {
    //         const participanteEvento = await firestore.collection('events')
    //             .doc(evento)
    //             .get()
    //             .then( e => e.exists ? e.data() : null );
    //         evento = participanteEvento && participanteEvento.active ? evento : null;
    //         mensagem = participante && participanteEvento.message ? participanteEvento.message : '';
    //         mediaUrl = participante && participanteEvento.mediaUrl ? participanteEvento.mediaUrl : '';
    //     }
    // } 
    
    // // Caso não tenha evento definido ou ativo, carregar evento default ativo
    // if (!evento) {
    //     // Sem evento - definir default
    //     const eventos = await firestore.collection('events')
    //         .where('default', '==', true)
    //         .where('active', '==', true)
    //         .get()
    //         .then(snapshot => {
    //             return snapshot.docs.map(doc => {
    //                 return { key: doc.id, ...doc.data() }
    //             });
    //         });

    //     if (eventos.length > 0) {
    //         evento = eventos[0].key
    //         mensagem = eventos[0].message ? eventos[0].message : '';
    //         mediaUrl = eventos[0].mediaUrl ? eventos[0].mediaUrl : '';
    //     }
    // } else {

    // }
    // mensagem = mensagem.split('<e>').join('\n');

    callback(null, {
        ...activationData
    });

};
