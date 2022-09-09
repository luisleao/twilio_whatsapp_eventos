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
    event: filaId
*/
exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();

    const participante = await firestore.collection('participantes')
        .doc(event.filaId).get().then(s => {
            if (s.exists) {
                return s.data();
            } else {
                return null;
            }
        });

    if (!participante) {

        return callback(null, {
            erro: true,
            mensagem: 'Participante não encontrado!\n\nInforme para responsável da Twilio.'
        });

    } 


    // mudar status para 'cancelado'
    await firestore.collection('events')
        .doc(participante.ultimoEvento).collection('agendamento')
        .doc(event.filaId).delete()

    // TODO: listar 1 e 5 com status 'fila' e mandar mensagem


    // enviar mensagem para pessoa selecionada
    let mensagem = `Olá *${participante.nome}*!\n\nCancelamos sua reserva para a foto profissional.\n\nVocê ainda pode entrar novamente na fila.`
    await sendNotification(
        client,
        `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_TDC}`,
        `whatsapp:${participante.phoneNumber}`,
        mensagem
    );

    await firestore.collection('participantes').doc(event.filaId).set({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            fotografiaCancelamentos: admin.firestore.FieldValue.increment(1)
        }, { merge: true })

    await firestore.collection('events').doc(participante.ultimoEvento)
        .collection('participantes').doc(event.filaId).set({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            fotografiaCancelamentos: admin.firestore.FieldValue.increment(1)
        }, { merge: true })

    callback(null, {
        erro: false,
        mensagem: 'Participante removido da fila com sucesso!'
    })
    
};
