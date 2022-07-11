const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD } = require(Runtime.getFunctions()['util'].path);


if (!admin.apps.length) {
    admin.initializeApp({}); 
} else {
    admin.app();
}

const firestore = admin.firestore();
const md5 = require('md5');

exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();

    // collection
    // doc


    // Verificar se existe no Sympla
    const sympla = await firestore.collection('events').doc('frontin').collection('sympla').doc(event.sympla.toUpperCase()).get();
    if (sympla.exists) {
        // Erro - participante já utilizou este codigo
        return callback(null, {
            erro: true,
            mensagem: 'Este código do Sympla já foi utilizado.'
        });
    }

    let participanteId = await md5(limpaNumero(event.from));

    // Salvar o registro do participante
    await firestore.collection('events').doc('frontin').collection('participantes')
        .doc(participanteId).set({
            nome: event.nome,
            sympla: event.sympla,
            linkedin: event.linkedin,
            pronome: event.pronome,
            impressoes: 0,
            createdAt: admin.firestore.FieldValue.serverTimestamp()
        });

    // Salvar o registro do Sympla
    await firestore.collection('events').doc('frontin').collection('sympla')
        .doc(event.sympla.toUpperCase()).set({
        participanteId: participanteId,
        createdAt: admin.firestore.FieldValue.serverTimestamp()
    }, { merge: true });

 
    return callback(null, {
        erro: true,
        mensagem: 'Seu registro foi realizado com sucesso!\n\nNo local do evento procure o estande da Twilio para imprimir sua credencial.'
    });


};