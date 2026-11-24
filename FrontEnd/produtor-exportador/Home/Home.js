const { $, node, formatDate, setEmpty, request } = window.ProdutorApp;
const temperatureFormat = new Intl.NumberFormat("pt-BR", { maximumFractionDigits: 2 });

async function loadSensors() {
  const list = $("#sensorStatusList");
  try {
    const { data: sensors } = await request("sensors");
    const active = sensors.filter((sensor) => sensor.status === "ATIVO").length;
    $("#activeCount").textContent = String(active);
    $("#sensorCountNote").textContent = `${sensors.length} sensor(es) vinculado(s) aos seus talhões`;
    list.replaceChildren();
    if (!sensors.length) {
      setEmpty(list, "Nenhum sensor está vinculado aos seus talhões.");
      return sensors;
    }
    sensors.forEach((sensor) => {
      const row = node("div", "pe-row");
      const main = node("div", "pe-row-main");
      main.append(node("strong", "", sensor.identificador), node("small", "", `${sensor.talhao.nome} · ${sensor.talhao.propriedade.nome}`));
      const badge = node("span", `pe-badge ${sensor.status === "ATIVO" ? "" : sensor.status === "MANUTENCAO" ? "warn" : "danger"}`, sensor.status);
      row.append(main, badge);
      list.append(row);
    });
    return sensors;
  } catch (error) {
    $("#activeCount").textContent = "—";
    $("#sensorCountNote").textContent = "Não foi possível consultar sensores";
    setEmpty(list, error.message || "Não foi possível carregar os sensores.");
    return [];
  }
}

async function loadWeather() {
  const empty = $("#weatherEmpty");
  try {
    const { data: sensors } = await request("sensors");
    const latestReading = sensors
      .filter((sensor) => sensor.ultimaLeitura)
      .map((sensor) => ({ ...sensor.ultimaLeitura, sensor }))
      .sort((first, second) => new Date(second.timestamp) - new Date(first.timestamp))[0];
    if (!latestReading) {
      $("#latestTemperature").textContent = "—";
      $("#latestReadingTime").textContent = "Nenhuma leitura registrada";
      $("#weatherTemperature").innerHTML = "— <small>°C</small>";
      $("#weatherHumidity").innerHTML = "— <small>%</small>";
      $("#readingStatus").textContent = "Sem leitura";
      $("#readingStatus").className = "pe-badge info";
      empty.hidden = false;
      return;
    }
    const latest = latestReading;
    $("#latestTemperature").textContent = `${temperatureFormat.format(latest.temperatura)} °C`;
    $("#latestReadingTime").textContent = formatDate(latest.timestamp, { dateStyle: "short", timeStyle: "short" });
    $("#weatherTemperature").innerHTML = `${temperatureFormat.format(latest.temperatura)} <small>°C</small>`;
    $("#weatherHumidity").innerHTML = `${temperatureFormat.format(latest.umidade)} <small>%</small>`;
    $("#readingSensor").textContent = `${latest.sensor.identificador} · ${latest.sensor.talhao.nome}`;
    $("#readingTimestamp").textContent = `Registrada em ${formatDate(latest.timestamp, { dateStyle: "medium", timeStyle: "short" })}`;
    $("#readingStatus").textContent = latest.sensor.status;
    $("#readingStatus").className = `pe-badge ${latest.sensor.status === "ATIVO" ? "" : "danger"}`;
    empty.hidden = true;
  } catch (error) {
    $("#latestTemperature").textContent = "—";
    $("#latestReadingTime").textContent = "Não foi possível consultar leituras";
    $("#readingStatus").textContent = "Indisponível";
    $("#readingStatus").className = "pe-badge danger";
    empty.hidden = false;
    empty.querySelector("p").textContent = error.message || "Não foi possível carregar as leituras.";
  }
}

async function loadForecast() {
  const panel = $("#forecastPanel");
  try {
    const { data: forecasts } = await request("forecasts");
    if (!forecasts.length) {
      setEmpty(panel, "Nenhuma janela futura foi cadastrada para seus talhões.");
      $("#nextWindowDate").textContent = "—";
      $("#nextWindowNote").textContent = "Sem previsão cadastrada";
      return;
    }
    const next = forecasts[0];
    $("#nextWindowDate").textContent = formatDate(next.dataInicio, { day: "2-digit", month: "short" });
    $("#nextWindowNote").textContent = `${next.tipo === "COLHEITA" ? "Colheita" : "Exportação"} · ${next.talhao.nome}`;
    panel.replaceChildren();
    const row = node("div", "pe-row");
    const main = node("div", "pe-row-main");
    main.append(node("strong", "", `${next.talhao.nome} · ${next.tipo === "COLHEITA" ? "Colheita" : "Exportação"}`));
    main.append(node("small", "", `${formatDate(next.dataInicio)} até ${formatDate(next.dataFim)}${next.talhao.propriedade?.nome ? ` · ${next.talhao.propriedade.nome}` : ""}`));
    const confidence = next.confianca === null ? "Confiança não informada" : `${temperatureFormat.format(next.confianca)}% de confiança`;
    row.append(main, node("span", "pe-badge info", confidence));
    panel.append(row);
  } catch (error) {
    setEmpty(panel, error.message || "Não foi possível carregar as previsões.");
    $("#nextWindowDate").textContent = "—";
    $("#nextWindowNote").textContent = "Previsões indisponíveis";
  }
}

const historyCanvas = $("#producerHistoryChart");
const historyNote = $("#producerHistoryNote");
const historySensor = $("#producerHistorySensor");
const historyPeriod = $("#producerHistoryPeriod");
const historyMetric = $("#producerHistoryMetric");
const historyType = $("#producerHistoryType");
let historyChart;
let historyReadings = [];

function historyChartPalette() {
  const dark = document.documentElement.classList.contains("dark-theme");
  return {
    text: dark ? "#b8c9b3" : "#687365",
    grid: dark ? "#435443" : "#d4ddca",
    line: dark ? "#a9c796" : "#33512A",
    fill: dark ? "#a9c79635" : "#a9c88d45",
  };
}

function renderHistoryChart() {
  if (typeof Chart === "undefined") {
    historyNote.textContent = "O gráfico não carregou. Verifique sua conexão e atualize a página.";
    return false;
  }
  const palette = historyChartPalette();
  const metric = historyMetric.value;
  const type = historyType.value;
  const label = metric === "temperatura" ? "Temperatura (°C)" : "Umidade (%)";
  const unit = metric === "temperatura" ? "°C" : "%";
  const labels = historyReadings.map((reading) => formatDate(reading.timestamp, {
    day: "2-digit",
    month: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }));
  const values = historyReadings.map((reading) => reading[metric]);

  if (!historyChart || historyChart.config.type !== type) {
    historyChart?.destroy();
    historyChart = new Chart(historyCanvas, {
      type,
      data: { labels, datasets: [{ label, data: values }] },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        animation: false,
        color: palette.text,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (context) => `${label}: ${temperatureFormat.format(context.parsed.y ?? context.parsed)} ${unit}`,
            },
          },
        },
        scales: {
          x: {
            ticks: { color: palette.text, maxTicksLimit: 8, maxRotation: 0 },
            grid: { display: false },
          },
          y: {
            beginAtZero: metric === "umidade",
            suggestedMin: metric === "temperatura" ? 0 : undefined,
            ticks: {
              color: palette.text,
              callback: (value) => `${value} ${unit}`,
            },
            grid: { color: palette.grid },
          },
        },
      },
    });
  } else {
    historyChart.data.labels = labels;
    historyChart.data.datasets[0].label = label;
    historyChart.data.datasets[0].data = values;
    historyChart.options.scales.y.beginAtZero = metric === "umidade";
    historyChart.options.scales.y.suggestedMin = metric === "temperatura" ? 0 : undefined;
    historyChart.options.scales.y.ticks.callback = (value) => `${value} ${unit}`;
    historyChart.update("none");
  }

  historyChart.options.color = palette.text;
  historyChart.options.scales.x.ticks.color = palette.text;
  historyChart.options.scales.y.ticks.color = palette.text;
  historyChart.options.scales.y.grid.color = palette.grid;
  historyChart.data.datasets[0].borderColor = palette.line;
  historyChart.data.datasets[0].backgroundColor = type === "line" ? palette.fill : palette.line;
  historyChart.data.datasets[0].borderRadius = type === "bar" ? 5 : 0;
  historyChart.data.datasets[0].fill = type === "line";
  historyChart.data.datasets[0].tension = 0.3;
  historyChart.data.datasets[0].pointRadius = historyReadings.length > 50 ? 0 : 2;
  historyChart.update("none");
  return true;
}

async function loadHistory() {
  historyNote.textContent = "Carregando leituras do banco...";
  try {
    const sensorId = historySensor.value;
    const periodHours = historyPeriod.value;
    const query = new URLSearchParams({ horas: periodHours });
    if (sensorId) query.set("sensorId", sensorId);

    const { data } = await request(`weather-data?${query}`);
    historyReadings = data;
    if (!renderHistoryChart()) return;
    historyNote.textContent = data.length
      ? `${data.length} leitura(s) do banco no período selecionado.`
      : "Nenhuma leitura encontrada para este sensor e período.";
  } catch (error) {
    console.error("Falha ao carregar o histórico climático do banco:", error);
    historyReadings = [];
    renderHistoryChart();
    historyNote.textContent = error.message || "Não foi possível carregar as leituras do banco.";
  }
}

async function initializeHistory() {
  try {
    const { data: sensors } = await request("sensors");
    historySensor.replaceChildren(new Option("Todos os sensores", ""));
    sensors.forEach((sensor) => {
      historySensor.add(new Option(sensor.identificador, sensor.id));
    });
    const latestSensor = sensors
      .filter((sensor) => sensor.ultimaLeitura)
      .sort((first, second) => new Date(second.ultimaLeitura.timestamp) - new Date(first.ultimaLeitura.timestamp))[0];
    if (latestSensor) historySensor.value = latestSensor.id;
    if (!sensors.length) historyNote.textContent = "Nenhum sensor cadastrado para esta propriedade.";
    await loadHistory();
  } catch (error) {
    console.error("Falha ao preparar o histórico climático:", error);
    historyNote.textContent = error.message || "Não foi possível carregar os sensores do banco.";
  }
}

historySensor.addEventListener("change", loadHistory);
historyPeriod.addEventListener("change", loadHistory);
historyMetric.addEventListener("change", renderHistoryChart);
historyType.addEventListener("change", renderHistoryChart);
new MutationObserver(renderHistoryChart).observe(document.documentElement, {
  attributes: true,
  attributeFilter: ["class"],
});

loadSensors();
loadWeather();
loadForecast();
initializeHistory();
