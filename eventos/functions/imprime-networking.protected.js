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
    event: evento, token, from, to
*/
exports.handler = async function(context, event, callback) {
    let participanteId = await md5(limpaNumero(event.from));

    let id = await firestore.collection('labels')
        .add({
            url: `https://wa.me/${limpaNumero(event.to, true)}?text=${participanteId}`,
            evento: event.evento,
            printer: event.token.toUpperCase(),
            telefone: escondeNumero(limpaNumero(event.from)),
            participanteId: participanteId
        }).then(s => {
            return s.id
        });
    
    callback(null, id);

};
