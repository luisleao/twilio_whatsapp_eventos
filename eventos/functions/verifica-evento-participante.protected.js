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
    let participanteId = await md5(limpaNumero(event.from));

    let evento = null;
    let mensagem = '';
    let mediaUrl = '';

    console.log('participanteId', participanteId);

    const participante = await firestore.collection('participantes')
        .doc(participanteId)
        .get()
        .then( p => p.exists ? p.data() : null );

    if (participante) {
        evento = participante.evento || null;
        // Verificar se evento estiver ativo
        if (evento != null) {
            const participanteEvento = await firestore.collection('events')
                .doc(evento)
                .get()
                .then( e => e.exists ? e.data() : null );
            evento = participanteEvento && participanteEvento.active ? evento : null;
            mensagem = participante && participanteEvento.message ? participanteEvento.message : '';
            mediaUrl = participante && participanteEvento.mediaUrl ? participanteEvento.mediaUrl : '';
        }
    } 
    
    // Caso não tenha evento definido ou ativo, carregar evento default ativo
    if (!evento) {
        // Sem evento - definir default
        const eventos = await firestore.collection('events')
            .where('default', '==', true)
            .where('active', '==', true)
            .get()
            .then(snapshot => {
                return snapshot.docs.map(doc => {
                    return { key: doc.id, ...doc.data() }
                });
            });

        if (eventos.length > 0) {
            evento = eventos[0].key
            mensagem = eventos[0].message ? eventos[0].message : '';
            mediaUrl = eventos[0].mediaUrl ? eventos[0].mediaUrl : '';
        }
    } else {

    }
    mensagem = mensagem.split('<e>').join('\n');

    callback(null, {
        evento, mensagem, mediaUrl
    });

};
