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
    event: filaId, pasta
*/
exports.handler = async function(context, event, callback) {

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


    // Mudar status para 'atendimento'
    await firestore.collection('events')
        .doc(participante.ultimoEvento).collection('agendamento')
        .doc(event.filaId).set({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'atendimento'
        }, { merge: true });

    
        
    // TODO: não criar pasta se já existir uma no banco de agendamentos


    // Criar pasta do drive
    // const { GoogleAuth } = require('google-auth-library');
    // const { google } = require('googleapis');
    
    // const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/drive' });
    // const service = google.drive({ version: 'v3', auth });
    // const fileMetadata = {
    //     'name': `${escondeNumero(participante.phoneNumber)} ${participante.nome}`,
    //     'mimeType': 'application/vnd.google-apps.folder',
    //     'parents': [ process.env.FOTOGRAFIA_PASTA_RAIZ ]
    // };

    // // try {
    //     const file = await service.files.create({
    //         resource: fileMetadata,
    //         fields: 'id',
    //     });

        await firestore.collection('events')
            .doc(participante.ultimoEvento).collection('agendamento')
            .doc(event.filaId).set({
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // pasta: event.pasta //file.data.id
            }, { merge: true });

        await firestore.collection('events')
            .doc(participante.ultimoEvento).collection('participantes')
            .doc(event.filaId).set({
                updatedAt: admin.firestore.FieldValue.serverTimestamp(),
                // pasta: file.data.id
            }, { merge: true });

        
        return callback(null, {
            erro: false,
            mensagem: 'Atendimento iniciado com sucesso!',
            // pasta: file.data.id
        });
    
    // } catch (err) {
    //     return callback(null, {
    //         erro: true,
    //         mensagem: `Ocorreu um erro ao criar a pasta!\n\n${JSON.stringify(err)}`,
    //     });
    // }

};
