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

*/
exports.handler = async function(context, event, callback) {


    const eventos = await firestore.collection('events')
        .where('default', '==', true)
        .where('active', '==', true)
        .get()
        .then(snapshot => {
            return snapshot.docs.map(doc => {
                return { key: doc.id, ...doc.data() }
            });
        });

    const evento = eventos.length > 0 ? eventos[0].key : 'tdcbusiness2022';

    // mudar status para 'cancelado'
    let lista = await firestore.collection('events')
        .doc(evento).collection('agendamento')
        .orderBy('posicao', 'asc')
        .get().then(s => {
            return s.docs.map(d => {
                return { id: d.id, ...d.data()}
            })
        });

    callback(null, {
        lista
    })
    
};
