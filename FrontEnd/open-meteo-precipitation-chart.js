(function () {
  const endpoint = 'https://api.open-meteo.com/v1/forecast?latitude=-9.39&longitude=-40.50&current=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&hourly=temperature_2m,relative_humidity_2m,wind_speed_10m,precipitation&timezone=America%2FSao_Paulo';
  const lightColors = ['#33512A', '#547547', '#6F8F4F', '#849B65', '#A9BB84', '#C6D78D'];
  const darkColors = ['#A9C796', '#85B8CF', '#84917B', '#6F8F4F', '#C6D78D', '#547547'];

  function saoPauloHour() {
    const parts = new Intl.DateTimeFormat('en-CA', {
      timeZone: 'America/Sao_Paulo',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      hourCycle: 'h23'
    }).formatToParts(new Date());
    const values = Object.fromEntries(parts.map(({ type, value }) => [type, value]));
    return `${values.year}-${values.month}-${values.day}T${values.hour}:${values.minute}`;
  }

  function initialize(canvas) {
    const card = canvas.closest('.weather-precipitation-card');
    const status = card.querySelector('[data-weather-status]');
    const legend = card.querySelector('[data-weather-legend]');

    if (typeof Chart === 'undefined') {
      status.textContent = 'Não foi possível carregar o gráfico.';
      console.error('Chart.js não está disponível para o gráfico climático.');
      return;
    }

    status.textContent = 'Carregando previsão de precipitação...';
    fetch(endpoint)
      .then((response) => {
        if (!response.ok) throw new Error(`Open-Meteo respondeu com HTTP ${response.status}.`);
        return response.json();
      })
      .then((forecast) => {
        const times = forecast.hourly?.time;
        const precipitation = forecast.hourly?.precipitation;
        if (!Array.isArray(times) || !Array.isArray(precipitation) || times.length !== precipitation.length) {
          throw new Error('A resposta do Open-Meteo não contém os dados horários esperados.');
        }

        const now = saoPauloHour();
        const hours = times
          .map((time, index) => ({ time, value: precipitation[index] }))
          .filter(({ time }) => time >= now)
          .slice(0, 24)
          .map(({ time, value }) => ({
            label: time.slice(11, 16),
            value: typeof value === 'number' && Number.isFinite(value) ? Math.max(0, value) : 0
          }));

        if (!hours.length) throw new Error('A previsão não contém horas futuras disponíveis.');

        const total = hours.reduce((sum, hour) => sum + hour.value, 0);
        const rainingHours = total > 0 ? hours.filter((hour) => hour.value > 0) : [];
        const dark = document.documentElement.classList.contains('dark-theme');
        const colors = dark ? darkColors : lightColors;
        const labels = rainingHours.length ? rainingHours.map((hour) => hour.label) : ['Sem precipitação'];
        const amounts = rainingHours.length ? rainingHours.map((hour) => hour.value) : [1];
        const chartColors = rainingHours.length
          ? rainingHours.map((_, index) => colors[index % colors.length])
          : [dark ? '#475048' : '#D4DDCA'];

        new Chart(canvas, {
          type: 'pie',
          data: {
            labels,
            datasets: [{
              data: amounts,
              backgroundColor: chartColors,
              borderColor: dark ? '#252A27' : '#FFFFFF',
              borderWidth: 2
            }]
          },
          options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
              legend: { display: false },
              tooltip: {
                callbacks: {
                  label(context) {
                    if (!rainingHours.length) return 'Sem precipitação prevista';
                    const amount = context.raw;
                    const share = total ? (amount / total) * 100 : 0;
                    return ` ${amount.toLocaleString('pt-BR')} mm · ${share.toLocaleString('pt-BR', { maximumFractionDigits: 1 })}% do total`;
                  }
                }
              }
            }
          }
        });

        legend.replaceChildren();
        if (rainingHours.length) {
          rainingHours.forEach((hour, index) => {
            const item = document.createElement('li');
            const marker = document.createElement('span');
            marker.className = 'weather-precipitation-marker';
            marker.style.backgroundColor = chartColors[index];
            const label = document.createElement('span');
            label.textContent = `${hour.label} · ${hour.value.toLocaleString('pt-BR')} mm`;
            item.append(marker, label);
            legend.append(item);
          });
          status.textContent = `Precipitação prevista nas próximas ${hours.length} horas: ${total.toLocaleString('pt-BR')} mm. Selecione uma fatia para ver sua participação no total.`;
        } else {
          status.textContent = `Sem precipitação prevista nas próximas ${hours.length} horas.`;
        }
      })
      .catch((error) => {
        console.error('Falha ao carregar a previsão Open-Meteo:', error);
        status.textContent = 'Não foi possível carregar a previsão do clima. Verifique a conexão e tente novamente.';
      });
  }

  document.querySelectorAll('[data-weather-precipitation-chart]').forEach(initialize);
})();
