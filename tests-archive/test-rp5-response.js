// Тестовый скрипт для проверки ответа RP5

async function testRP5Response() {
  const wmoId = '28573'; // Ишим
  const startDate = '02.07.2023';
  const endDate = '31.07.2023';
  
  const url = 'http://rp5.ru/responses/reFileSynop.php';
  const formData = new URLSearchParams({
    wmo_id: wmoId,
    datepicker1: startDate,
    datepicker2: endDate,
    f_ed3: '8',  // UTF-8
    f_ed4: '1',  // точка с запятой
    f_ed5: '1',  // только синоптические сроки
    f_ed2: '1',  // все дни
  });
  
  console.log('Отправляем запрос к RP5...');
  console.log('URL:', url);
  console.log('Параметры:', formData.toString());
  
  try {
    const response = await fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36',
      },
      body: formData.toString(),
    });
    
    console.log('Статус:', response.status);
    console.log('Content-Type:', response.headers.get('content-type'));
    
    const content = await response.text();
    console.log('Размер ответа:', content.length, 'байт');
    console.log('\nПервые 1000 символов ответа:');
    console.log('---');
    console.log(content.substring(0, 1000));
    console.log('---');
    
    if (content.startsWith('#')) {
      console.log('\n✓ Ответ начинается с # - это CSV файл');
    } else if (content.startsWith('<')) {
      console.log('\n✗ Ответ начинается с < - это HTML страница');
    } else {
      console.log('\n? Неизвестный формат ответа');
    }
  } catch (error) {
    console.error('Ошибка:', error.message);
  }
}

testRP5Response();
