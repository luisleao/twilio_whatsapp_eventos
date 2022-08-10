const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;

if (!admin.apps.length) {
  admin.initializeApp({}); 
} else {
  admin.app();
}
const firestore = admin.firestore();


exports.handler = async function(context, event, callback) {
    const EVENTO = 'frontin';

    let leads = event.leads;
    if (leads) {
        console.log('leads', leads.length);
        console.log(leads[0]);
        const { job_title, name, company, city, email, user, tags, personal_phone } = leads[0];

        await firestore.collection('events').doc(EVENTO).collection('certificado').doc(leads[0].email).set({
            job_title, 
            name, 
            company, 
            city, 
            email, 
            user, 
            tags, 
            telefone: personal_phone.replace(/\D+/g, ''),
            personal_phone
        }, { merge: true });

        const client = await context.getTwilioClient();
        const message = `Olá ${name}.\n\nAgradecemos por participar do *FrontinSampa 2022*.\nSeu certificado de participação já está disponível.`

        await client.messages.create({
          from: `whatsapp:${process.env.TWILIO_WHATSAPP_NUMBER}`,
          to: `whatsapp:${personal_phone.replace(/\D+/g, '')}`,
          body: message,
        });

    }
    console.log('RDStation ', JSON.stringify(event));
    console.log(event);

    return callback(null, "OK");
}
