const https = require('https');

const url = 'https://weatherarchive-pg4r.onrender.com/';

console.log('Проверяю версию на Render...\n');

https.get(url, (res) => {
  console.log(`Статус: ${res.statusCode}`);
  console.log(`Заголовки:`, res.headers);
  
  let data = '';
  res.on('data', (chunk) => {
    data += chunk;
  });
  
  res.on('end', () => {
    console.log('\nСервер отвечает, проверьте логи Render Dashboard');
    console.log('https://dashboard.render.com');
  });
}).on('error', (err) => {
  console.error('Ошибка:', err.message);
});
