const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();



exports.handler = async function(context, event, callback) {
    console.log('email', event.email)

    // verificar se ja usou o codigo
    const registroEmail = await firestore.collection('events').doc(event.evento).collection('emails').doc(event.email.toLowerCase()).get();
    if (!registroEmail.exists) {
        // Erro - participante já utilizou este codigo
        return callback(null, {
            resultado: 'INEXISTENTE',
            mensagem: 'E-mail informado não foi encontrado no sistema.'
        });
    }
    const emailData = registroEmail.data();

    console.log('emailData', emailData);
    
    if (emailData.usado) {
        callback(null, {
            resultado: 'USADO',
            mensagem: 'Este e-mail já foi utilizado para um registro.'
        });
    }

    callback(null, {
        resultado: 'VALIDO',
        existe: registroEmail.exists,
        ...emailData
    });
};
