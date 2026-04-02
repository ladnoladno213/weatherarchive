/**
 * weather-icons.js
 * DOM-патч: добавляет иконки погоды в таблицу после рендера React
 */
(function () {
  'use strict';

  // Маппинг облачности (%) → CSS-класс
  function cloudinessIcon(pct, isDay) {
    const p = parseInt(pct, 10);
    if (isNaN(p)) return null;
    const sfx = isDay ? 'day' : 'night';
    if (p <= 10)  return 'wi wi-clear-' + sfx;
    if (p <= 25)  return 'wi wi-cloud-light-' + sfx;
    if (p <= 50)  return 'wi wi-cloud-few-' + sfx;
    if (p <= 75)  return 'wi wi-cloudy-' + sfx;
    if (p <= 90)  return 'wi wi-cloud-heavy-' + sfx;
    return 'wi wi-overcast-' + sfx;
  }

  // Маппинг осадков (мм) → CSS-класс (упрощённо: дождь)
  function precipIcon(mm) {
    const v = parseFloat(mm);
    if (isNaN(v) || v <= 0) return null;
    if (v < 1)  return 'wi wi-rain-light';
    if (v < 5)  return 'wi wi-rain-moderate';
    return 'wi wi-rain-heavy';
  }

  function makeIcon(cls) {
    const span = document.createElement('span');
    span.className = cls;
    span.style.display = 'inline-block';
    span.style.verticalAlign = 'middle';
    span.style.marginRight = '2px';
    return span;
  }

  // Определяем день/ночь по текущему часу (упрощённо)
  function isDayHour(h) {
    return h >= 6 && h < 21;
  }

  function findRowByHeader(text) {
    const cells = document.querySelectorAll('td, th');
    for (const cell of cells) {
      if (cell.textContent.trim().startsWith(text)) {
        return cell.closest('tr');
      }
    }
    return null;
  }

  // Получить заголовки часов из строки "Местное время"
  function getHourHeaders() {
    const timeRow = findRowByHeader('Местное время');
    if (!timeRow) return [];
    const cells = Array.from(timeRow.querySelectorAll('td, th'));
    return cells.slice(1).map(c => parseInt(c.textContent.trim(), 10));
  }

  function patchRow(row, mapFn, hours) {
    if (!row) return;
    const cells = Array.from(row.querySelectorAll('td, th')).slice(1);
    cells.forEach((cell, i) => {
      const val = cell.textContent.trim();
      if (!val) return;
      const hour = hours[i];
      const isDay = hour !== undefined ? isDayHour(hour) : true;
      const cls = mapFn(val, isDay);
      if (!cls) return;
      // Не дублировать
      if (cell.querySelector('.wi')) return;
      const icon = makeIcon(cls);
      cell.insertBefore(icon, cell.firstChild);
      cell.style.whiteSpace = 'nowrap';
    });
  }

  function patch() {
    const hours = getHourHeaders();
    const cloudRow = findRowByHeader('Облачность');
    const precipRow = findRowByHeader('Осадки');
    patchRow(cloudRow, cloudinessIcon, hours);
    patchRow(precipRow, precipIcon, hours);
  }

  // Запускаем после рендера React через MutationObserver
  let timer = null;
  const observer = new MutationObserver(() => {
    clearTimeout(timer);
    timer = setTimeout(() => {
      patch();
    }, 300);
  });

  observer.observe(document.body, { childList: true, subtree: true });

  // Первый запуск после загрузки
  window.addEventListener('load', () => setTimeout(patch, 500));
})();
