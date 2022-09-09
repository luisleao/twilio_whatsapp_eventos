const admin = require('firebase-admin');

process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, sendNotificationMedia, convertNewLine, fillParams } = require(Runtime.getFunctions()['util'].path);

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();

const TIPOS_ARQUIVOS_PERMITIDOS = [
    'image/jpeg',
    'image/png'
];

const { GoogleAuth } = require('google-auth-library');
const { google } = require('googleapis');

const auth = new GoogleAuth({ scopes: 'https://www.googleapis.com/auth/drive' });
const service = google.drive({ version: 'v3', auth });


// let log = [];
let client, participante;

const batch = firestore.batch();

/*
    event: filaId, pasta
*/
exports.handler = async function(context, event, callback) {
    client = await context.getTwilioClient();

    participante = await firestore.collection('participantes')
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

    const agendamento = await firestore.collection('events')
        .doc(participante.ultimoEvento).collection('agendamento')
        .doc(event.filaId).get().then(s => {
            if (s.exists) {
                return s.data();
            } else {
                return null;
            }
        });

    if (!agendamento) {
        return callback(null, {
            erro: true,
            mensagem: 'Registro de fila não encontrado!\n\nInforme para responsável da Twilio.'
        });
    }

    if (!event.pasta) {
        return callback(null, {
            erro: true,
            mensagem: 'Participante não possui pasta do DRIVE!\n\nRetorne para a fila e tente novamente.'
        });
    }


    agendamento.pasta = event.pasta;

    // Carregar arquivos da pasta do Drive
    

    const arquivos = await service.files.list({
        q: `'${agendamento.pasta}' in parents`
    }).then(r => {
        return r.data
    });

    console.log('RESULT', arquivos);
    if (!arquivos || !arquivos.files) {
        return callback(null, {
            erro: true,
            mensagem: 'Participante não possui pasta do DRIVE!\n\nRetorne para a fila e tente novamente.'
        });

    }


    const fotos = arquivos.files.filter( f => TIPOS_ARQUIVOS_PERMITIDOS.includes(f.mimeType)).map( f => {
        return { ...f, filaId: event.filaId}
    }); 

    if (fotos.length == 0) {
        return callback(null, {
            erro: true,
            mensagem: 'Nenhuma foto encontrada no DRIVE!\n\nTente finalizar novamente por favor.'
        });
    }

    console.log('FOTOS', fotos);

    let mensagem = [];
    if (fotos.length > 1) {
        mensagem.push(`🚨 ${participante.nome}, aqui estão as fotos do Connect Foto Iteris! 🚨`);
    } else {
        mensagem.push(`🚨 ${participante.nome}, aqui está a foto do Connect Foto Iteris! 🚨`);
    }
    mensagem.push(`Temos um total de ${fotos.length} foto${fotos.length > 1 ? 's' : ''} 🎉`)
    mensagem.push(`Você pode acessar os originais pelo link https://drive.google.com/drive/folders/${agendamento.pasta}`);



    // console.log();
    // console.log(mensagem.join('\n\n'));
    // console.log();

    try {

        const promises = fotos.map(adicionaFilaEnvio);
        await Promise.all(promises);

        await batch.commit();

        // const promises = fotos.map(processaFotosFirebase);
        // await Promise.all(promises);
    } catch (x) {
        console.log('ERROR', x);
    }

    console.log('concluido');
    


    // Mudar status para 'concluido'
    await firestore.collection('events')
        .doc(participante.ultimoEvento).collection('agendamento')
        .doc(event.filaId).set({
            pasta: event.pasta,
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            status: 'concluido',
            totalFotos: fotos.length
        }, { merge: true });


    await sendNotification(
        client,
        `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_TDC}`,
        `whatsapp:${participante.phoneNumber}`,
        mensagem.join('\n\n')
    );
    
    // Adicionar contador de fotos enviadas
    await firestore.collection('participantes').doc(event.filaId).set({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            fotografiaEnviadas: admin.firestore.FieldValue.increment(fotos.length)
        }, { merge: true });

    await firestore.collection('events').doc(participante.ultimoEvento)
        .collection('participantes').doc(event.filaId).set({
            updatedAt: admin.firestore.FieldValue.serverTimestamp(),
            fotografiaEnviadas: admin.firestore.FieldValue.increment(fotos.length)
        }, { merge: true });



    return callback(null, {
        erro: false,
        mensagem: 'Atendimento finalizado com sucesso!',
        // log
    });


};


async function adicionaFilaEnvio(f) {
    
    let ref = firestore.collection('envioFoto').doc();
    batch.set(ref, {
        fileId: f.id,
        name: f.name,
        contentType: f.mimeType,
        participanteId: f.filaId,
        telefone: participante.phoneNumber,
        destino: `fotos/${f.filaId}/${f.id}`,
        createdAt: admin.firestore.FieldValue.serverTimestamp(),
        from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_TDC}`,
        to: `whatsapp:${participante.phoneNumber}`
    });

    // await firestore.collection('envioFoto').add({
    //     fileId: f.id,
    //     name: f.name,
    //     contentType: f.mimeType,
    //     participanteId: f.filaId,
    //     telefone: participante.phoneNumber,
    //     destino: `fotos/${f.filaId}/${f.id}`,
    //     createdAt: admin.firestore.FieldValue.serverTimestamp(),
    //     from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_TDC}`,
    //     to: `whatsapp:${participante.phoneNumber}`
    // });
}

async function processaFotosFirebase(f) {
    // try {
        console.log(`DOWNLOADING ${f.id}, ${f.mimeType}`);

        const urlArquivoAssinada = await service.files.get(
            { fileId: f.id, alt: 'media' },
            { responseType: 'stream' }
            ).then( async (res) => {
                return new Promise((resolve, reject) => {

                    const bucket = admin.storage().bucket(process.env.FOTOGRAFIA_BUCKET_PADRAO);
                    console.log(`fotos/${f.filaId}/${f.id}`);

                    const cloudFile = bucket.file(`fotos/${f.filaId}/${f.id}`);
                    let cloudStream = cloudFile.createWriteStream({
                        contentType: f.mimeType,
                        resumable: false,
                        // public: true
                    });

                    res.data.on('end', async () => {
                        console.log('DATA END');
                        const URL_ASSINADA = await cloudFile.getSignedUrl({
                            action: 'read',
                            expires: new Date(Date.now() + (3600 * 1000 * 24))
                        }).then(signedUrls => {
                            console.log(`SIGNED ${signedUrls[0]}`)
                            return signedUrls[0];
                        });
                        resolve(URL_ASSINADA);
                    }).pipe(cloudStream); //, { end: true });
                    
                });
        });

        // Envio imagem pelo WhatsApp
        await sendNotificationMedia(
            client,
            `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER_TDC}`,
            `whatsapp:${participante.phoneNumber}`,
            '',
            urlArquivoAssinada
        );

}