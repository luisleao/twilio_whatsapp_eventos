// Verificar possibilidade pedido de café e disparar mensagem com template



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
    event: evento, palestraId, from, choice, 
*/
exports.handler = async function(context, event, callback) {
    const palestraId = event.palestraId;
    const participanteId = await md5(limpaNumero(event.from));
    const idPlayerEvent = await md5(`${event.evento}:${limpaNumero(event.from)}`);

    console.log('Verifica Barista');
    // const WHATSAPP_BARISTA_TDC_TEMPLATE_SID = 'HXffa8c7f8cb308373b2a317d4afefd292';


    const { WHATSAPP_MESSAGE_SERVICE_SID, WHATSAPP_BARISTA_TDC_TEMPLATE_SID, ACCOUNT_SID, AUTH_TOKEN } = process.env;
    // const client = context.getTwilioClient();
    const client = require('twilio')(ACCOUNT_SID, AUTH_TOKEN);

    // Enviar mensagem Content API com opções de café

    // TODO: Verificar se participante está online ou não.

    await client.messages.create({
        contentSid: WHATSAPP_BARISTA_TDC_TEMPLATE_SID,
        messagingServiceSid: WHATSAPP_MESSAGE_SERVICE_SID, 
        to: event.from, //`whatsapp:${participante.phoneNumber}`,
        // ContentVariables: {}
    }).then(m => {
        console.log('SENT CONTENT MESSAGE', m.sid);
        callback(null, m.sid);
    }).catch(e => {
        callback(e, null);
    });

    // TODO: verificar se já não tem pedido em andamento ou se 
    // TODO: verificar se possui pontuação mínima para pedido
};
