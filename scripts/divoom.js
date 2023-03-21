const { Pixoo } = require('pixoo');

const PIXOO_IP = '192.168.50.246'; //'172.20.10.6'; // '10.0.1.2'; //'172.20.10.6'; //192.168.15.17
const INTERVALO = 2000;

const pixoo = new Pixoo(PIXOO_IP, 64);

function getBase64(file) {
    const fs = require('fs');
    return fs.readFileSync(file, {encoding: 'base64'});
}
const aleatorio = (maximo) => {
    return Math.floor(maximo* Math.random()); 
}


const red = [255, 0, 0];
const green = [0, 255, 0];
const blue = [0, 0, 255];
const white = [255, 255, 255];
const black = [0, 0, 0];
const purple = [255, 0, 255];


let pessoas = aleatorio(9999);
let loops = 0;
let videomatik = aleatorio(9999);
let pontos = aleatorio(99999);
let exibe = 'counter';

let stats = {}
let ranking = [
    {
        numero: '0955',
        pontos: 1234
    }
];

let timer = null;
let move = 'in';
let inicio = 2;
let linha = 2;









require("dotenv").config();

// Initialize Firebase
var admin = require("firebase-admin");

let printers = {};
let eventos = {};



if (!admin.apps.length) {
  admin.initializeApp();
}else {
   admin.app(); // if already initialized, use that one
}
const firestore = admin.firestore();


const { EVENT_ID } = process.env;




const init = async () => {

    await firestore.collection('events')
        .doc(EVENT_ID).onSnapshot(async s => {
            const eventoData = s.data();
            stats = eventoData.stats || {};
            console.log('UPDATED STATS', stats);

            
    });

        // Filtrar ordem de participantes que estao com game ativo
        ranking = await firestore.collection('events')
            .doc(EVENT_ID).collection('participantes')
            .where('game', '==', true)
            .orderBy('pontosAcumulados', 'desc')
            .limit(7)
            .onSnapshot(s => {
                ranking = s.docs.map(d => {
                    const participante = d.data();
                    return {
                        numero: participante.phoneNumber.slice(-4),
                        pontos: participante.pontosAcumulados
                    }
                });
                console.log('NEW RANKING', ranking);
            });


    // initialize
    console.log('iniciado');
    // await pixoo.init();
    await pixoo.fillRGB(0, 0, 0);
    play();
}

const printGameplay = async () => {

    await pixoo.fillRGB(0, 0, 0);
    await pixoo.fillRGB(0, 0, 0);

    await pixoo.drawText('>>>         <<<', [2, 1+linha], green);
    await pixoo.drawText('    NUMEROS    ', [2, 1+linha], red);

    let linhaAtual = 1;

    if (stats.pessoas) {
        linhaAtual++;
        await pixoo.drawText('PESSOAS ' + ('       '+stats.pessoas).slice(-7), [2, contaLinhas(linhaAtual)], white);
    }
    if (stats.conexoes) {
        linhaAtual++;
        await pixoo.drawText('CONEXOES ' + ('       '+stats.conexoes).slice(-6), [2, contaLinhas(linhaAtual)], white);
    }
    if (stats.pontos) {
        linhaAtual++;
        await pixoo.drawText('PONTOS ' + ('        '+stats.pontos).slice(-8), [2, contaLinhas(linhaAtual)], white);
    }
    if (stats.videomatik) {
        linhaAtual++;
        await pixoo.drawText('VIDEOMATIK ' + ('        '+stats.videomatik).slice(-4), [2, contaLinhas(linhaAtual)], white);
        // await pixoo.drawText('VIDEOS ' + ('        '+stats.videomatik).slice(-8), [2, contaLinhas(linhaAtual)], white);
    }

    if (!(stats.pessoas ||
        stats.conexoes ||
        stats.pontos ||
        stats.videomatik)
    ) {
        await pixoo.drawText('PARTICIPE', [2, contaLinhas(3)], white);
        await pixoo.drawText('E VEJA OS', [2, contaLinhas(4)], white);
        await pixoo.drawText('DADOS AQUI!', [2, contaLinhas(5)], white);

    } else {
        console.log('tem dado');
    }

    await pixoo.drawText('JOGUE NO WHATS', [2, contaLinhas(7)], green);
    await pixoo.drawText('11 5039-3737', [2, contaLinhas(8)], purple);
    await pixoo.drawText('11 5039-3737', [2, contaLinhas(8)], purple);
    // await pixoo.drawText('11 9999-9999', [2, contaLinhas(8)], purple);
    // await pixoo.drawText('11 9999-9999', [2, contaLinhas(8)], purple);

}

const ALTURA = 7;

const contaLinhas = (linha) => {
    return 5+((linha-1)*ALTURA);
}

const printRanking = async () => {

    await pixoo.fillRGB(0, 0, 0);
    await pixoo.fillRGB(0, 0, 0);

    // pixoo.drawText('===============', [2, 29], white);
    await pixoo.drawText('<<<         >>>', [2, 1+linha], blue);
    await pixoo.drawText('    RANKING    ', [2, 1+linha], green);

    if (ranking.length == 0) {
        await pixoo.drawText('PARTICIPE', [2, contaLinhas(3)], white);
        await pixoo.drawText('E VEJA O', [2, contaLinhas(4)], white);
        await pixoo.drawText('RANKING!', [2, contaLinhas(5)], white);
        // pixoo.drawBuffer();
        return;
    }

    for (p in ranking) {
        const cor = p > 0 ? white : green;
        await pixoo.drawText(`${parseInt(p)+1}º ${ranking[p].numero}: `+ ('     '+ranking[p].pontos).slice(-6), [2, contaLinhas(2 + parseInt(p))], cor);
    }
}

const play = async () => {
    // await pixoo.init();

    // exibe = 'ranking';
    loops++;
    // videomatik++;
    console.log(`Exibindo loop ${loops}`);
    

    switch (exibe) {
        case 'counter':
            await printGameplay();
            exibe = 'ranking';
            break;

        case 'ranking':
            await printRanking();
            exibe = 'counter';
            break;
    }
    if (exibe == 'ranking' && ranking.length == 0) {
        exibe = 'counter';
    }

    setTimeout(play, INTERVALO);
}

init();