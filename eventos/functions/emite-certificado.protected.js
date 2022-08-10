const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, convertNewLine } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();
const md5 = require('md5');


exports.handler = async function(context, event, callback) {
    const client = await context.getTwilioClient();
    const EVENTO = 'frontin';

    let mensagem = '';
    let mediaUrl = '';

    console.log('EVENT >>>>>', event);

    if (event.email) {

        let certificado = await firestore.collection('events').doc(EVENTO).collection('certificado').doc(event.email).get().then(s => {
            if (s.exists) {
                return s.data();
            }
            return null;
        });

        if (certificado) {
            let participanteId = await md5(limpaNumero(event.from));
            console.log('Certificado para ', participanteId);

            // adicionar registro de certificado
            await firestore.collection('events').doc(EVENTO).collection('certificado').doc(event.email).set({
                certificadoImpresso: true,
                certificadoEmitidoEm: admin.firestore.FieldValue.serverTimestamp(),
                participanteId
            }, { merge: true });

            // informar no evento que participante emitiu certificado
            await firestore.collection('events').doc(EVENTO).collection('participantes').doc(participanteId).set({
                certificado: true,
                certificadoImpressoes: admin.firestore.FieldValue.increment(1),
                certificadoEmitidoEm: admin.firestore.FieldValue.serverTimestamp(),
                certificadoNome: certificado.name
            }, { merge: true });


            mensagem = `Seu certificado será emitido para *${certificado.name}*`;
            mediaUrl = `https://certificado-5264.twil.io/pdf?nomeCor=%233ed427&nomeUpperCase=true&nome=${encodeURI(certificado.name)}&completo=false&palestra=${process.env.EVENTO_NOME}&duracao=${process.env.EVENTO_DURACAO}&evento=${process.env.EVENTO_NOME}&imagem=${process.env.EVENTO_IMAGEM_CERTIFICADO}`;


        } else {
            mensagem = 'O e-mail informado não foi informado\n\nComece o processo novamente por favor.'

        }

    } else {
        mensagem = 'Você deve informar um e-mail para poder emitir o certificado\n\nComece o processo novamente por favor.'
    }



    
    return callback(null, {
        mensagem,
        mediaUrl
    });
}
