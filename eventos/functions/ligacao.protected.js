const admin = require('firebase-admin');
process.env.GOOGLE_APPLICATION_CREDENTIALS = Runtime.getAssets()['/firebase-credentials.json'].path;
const { escondeNumero, limpaNumero, getDDD, sendNotification, convertNewLine, fillParams, adicionaNove } = require(Runtime.getFunctions()['util'].path);


/*
    event: from, numero1, numero2

*/
exports.handler = async function(context, event, callback) {

    console.log('LIGACAO');
    console.log(limpaNumero(event.numero1), 'vira', adicionaNove(limpaNumero(event.numero1)));
    console.log(limpaNumero(event.numero2), 'vira', adicionaNove(limpaNumero(event.numero2)));

    const client = await context.getTwilioClient();
    let mensagem = [];

    const twiml = new Twilio.twiml.VoiceResponse();
    twiml.say({
        language: 'pt-br',
        voice: 'Alice'
    }, 'Um momento... Estamos conectando você com a organização do sorteio.');

    // twiml.dial({
    //     callerId: limpaNumero(event.from)
    // }, limpaNumero(event.numero2));

    twiml.dial(adicionaNove(limpaNumero(event.numero2)));
    
    await client.calls.create({
        from: limpaNumero(event.from),
        to: adicionaNove(limpaNumero(event.numero1)),
        twiml: twiml.toString()
    });

    mensagem.push(`Em breve você receberá uma ligação.`);

    callback(null, {
        mensagem: mensagem.join('\n\n')
    });
};
