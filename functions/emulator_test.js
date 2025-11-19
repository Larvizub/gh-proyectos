const http = require('http');
const data = JSON.stringify({ data: { to: ['luis.arvizu@costaricacc.com'], subject: 'Prueba desde emulador', html: '<p>Prueba desde emulador</p>' } });

const options = {
  hostname: '127.0.0.1',
  port: 5001,
  path: '/gh-proyectos/us-central1/sendNotificationEmail',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Content-Length': Buffer.byteLength(data),
  },
};

const req = http.request(options, (res) => {
  let body = '';
  res.on('data', (chunk) => (body += chunk));
  res.on('end', () => {
    console.log('STATUS', res.statusCode);
    console.log('BODY', body);
  });
});

req.on('error', (err) => {
  console.error('REQUEST ERROR', err);
});

req.write(data);
req.end();
