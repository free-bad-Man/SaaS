const findings = [
  ["premium-publisher.example", "Domain mismatch", "BLOCK", "92"],
  ["seller-unknown / placement-31", "Broken supply chain", "BLOCK", "85"],
  ["video-feed-07", "Abnormal request velocity", "WATCH", "54"],
] as const;

const deliverables = [
  {
    number: "01",
    title: "Карта потерь",
    text: "Показываем, какие площадки, продавцы и placement дают наибольшую долю подозрительного трафика.",
  },
  {
    number: "02",
    title: "Объяснимые причины",
    text: "Для каждого срабатывания фиксируем правило и доказательство, а не выдаём непрозрачный магический балл.",
  },
  {
    number: "03",
    title: "Правила фильтрации",
    text: "Готовим проверяемый список allow, watch и block для дальнейшего shadow-mode подключения.",
  },
  {
    number: "04",
    title: "Отчёт для решения",
    text: "Отдаём итог в понятном виде: Excel/CSV, краткое заключение и приоритетный план действий.",
  },
] as const;

const steps = [
  ["Выгрузка", "Вы передаёте обезличенный фрагмент OpenRTB или event-лога за согласованный период."],
  ["Проверка", "Мы воспроизводимо анализируем supply chain, домены, устройства, дубли и временные аномалии."],
  ["Решение", "Вы получаете отчёт, список рисков и правила для безопасного shadow-mode пилота."],
] as const;

export default function Home() {
  return (
    <main>
      <nav className="nav shell" aria-label="Основная навигация">
        <a className="brand" href="#top" aria-label="IVT Guard — на главную">
          <span className="brand-mark" aria-hidden="true"><i /><i /><i /></span>
          <span>IVT GUARD</span>
        </a>
        <div className="nav-links">
          <a href="#demo">Демо</a>
          <a href="#process">Процесс</a>
          <a href="#offer">Оффер</a>
        </div>
        <a className="nav-cta" href="https://www.fl.ru/users/ifreebadmani/" target="_blank" rel="noreferrer">
          Обсудить аудит <span aria-hidden="true">↗</span>
        </a>
      </nav>

      <section className="hero shell" id="top">
        <div className="hero-copy">
          <p className="eyebrow"><span /> PRE-BID QUALITY CONTROL</p>
          <h1>Платите за рекламу.<br /><em>Не за ботов.</em></h1>
          <p className="lead">
            IVT Guard проверяет рекламные логи, находит подозрительные площадки и показывает,
            где бюджет уходит в некачественный трафик — с понятными причинами для каждого решения.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="https://www.fl.ru/users/ifreebadmani/" target="_blank" rel="noreferrer">
              Запросить аудит <span aria-hidden="true">→</span>
            </a>
            <a className="button button-ghost" href="#demo">Посмотреть демо</a>
          </div>
          <div className="hero-notes" aria-label="Преимущества">
            <span>Без подключения к production</span>
            <span>Обезличенные данные</span>
            <span>Объяснимый risk score</span>
          </div>
        </div>

        <div className="signal-card" aria-label="Демонстрация оценки запроса">
          <div className="signal-head">
            <span className="live-dot" />
            <span>SYNTHETIC REQUEST</span>
            <code>req-8FD2A1</code>
          </div>
          <div className="score-ring">
            <span className="score-value">85</span>
            <span className="score-label">RISK SCORE</span>
          </div>
          <div className="verdict"><span>DECISION</span><strong>BLOCK</strong></div>
          <ul className="reason-list">
            <li><span>site_domain_mismatch</span><b>+35</b></li>
            <li><span>invalid_supply_chain_node</span><b>+20</b></li>
            <li><span>device_os_ua_mismatch</span><b>+20</b></li>
            <li><span>incomplete_supply_chain</span><b>+10</b></li>
          </ul>
          <div className="signal-footer"><span>OpenRTB 2.6</span><span>Explainable rules</span></div>
        </div>
      </section>

      <section className="proof-strip" aria-label="Принципы сервиса">
        <div className="shell proof-inner">
          <span>OFFLINE-FIRST</span><i />
          <span>SHADOW-MODE BEFORE BLOCKING</span><i />
          <span>NO “100% HUMAN” CLAIMS</span><i />
          <span>REPRODUCIBLE RESULTS</span>
        </div>
      </section>

      <section className="demo-section shell" id="demo">
        <div className="section-heading">
          <div>
            <p className="eyebrow dark"><span /> ДЕМО-ОТЧЁТ</p>
            <h2>Не графики ради графиков.<br />Ответ: <em>где теряются деньги.</em></h2>
          </div>
          <p>Данные ниже синтетические и созданы специально для безопасной демонстрации системы.</p>
        </div>

        <div className="audit-board">
          <div className="audit-topbar">
            <div><span className="mini-logo">IG</span><b>Audit / August sample</b></div>
            <span className="audit-status"><i /> ANALYSIS COMPLETE</span>
          </div>
          <div className="metric-grid">
            <article><span>Обработано запросов</span><strong>2 000 000</strong><small>100% входного файла</small></article>
            <article><span>Подозрительный трафик</span><strong>14,8%</strong><small className="danger">↑ требует проверки</small></article>
            <article><span>Возможные потери</span><strong>126 400 ₽</strong><small>оценка по win price</small></article>
            <article><span>Рискованные placement</span><strong>31</strong><small>из 284 источников</small></article>
          </div>
          <div className="audit-body">
            <div className="distribution-card">
              <div className="card-title"><b>Распределение решений</b><span>OpenRTB requests</span></div>
              <div className="bar-chart" aria-label="Allow 76%, watch 9.2%, block 14.8%">
                <div style={{ "--bar": "76%" } as React.CSSProperties}><span>ALLOW</span><i /><b>76,0%</b></div>
                <div style={{ "--bar": "9.2%" } as React.CSSProperties}><span>WATCH</span><i /><b>9,2%</b></div>
                <div style={{ "--bar": "14.8%" } as React.CSSProperties}><span>BLOCK</span><i /><b>14,8%</b></div>
              </div>
            </div>
            <div className="finding-card">
              <div className="card-title"><b>Главные находки</b><span>risk score</span></div>
              <div className="finding-table">
                {findings.map(([source, reason, action, score]) => (
                  <div className="finding-row" key={source}>
                    <div><b>{source}</b><span>{reason}</span></div>
                    <span className={`action action-${action.toLowerCase()}`}>{action}</span>
                    <strong>{score}</strong>
                  </div>
                ))}
              </div>
            </div>
          </div>
          <div className="audit-footer"><span>✓ Подпись входного файла сохранена</span><span>✓ Каждое решение воспроизводимо</span></div>
        </div>
      </section>

      <section className="deliverables shell">
        <div className="section-kicker">ЧТО ПОЛУЧАЕТ КЛИЕНТ</div>
        <div className="deliverable-grid">
          {deliverables.map((item) => (
            <article key={item.number}>
              <span>{item.number}</span>
              <h3>{item.title}</h3>
              <p>{item.text}</p>
            </article>
          ))}
        </div>
      </section>

      <section className="process-section" id="process">
        <div className="shell process-grid">
          <div className="process-copy">
            <p className="eyebrow light"><span /> БЕЗОПАСНЫЙ СТАРТ</p>
            <h2>Сначала аудит.<br />Потом интеграция.</h2>
            <p>Мы не просим доступ к рекламному кабинету и не включаем блокировки в первый день. Начинаем с ограниченного набора обезличенных данных.</p>
          </div>
          <ol className="steps">
            {steps.map(([title, text], index) => (
              <li key={title}>
                <span>0{index + 1}</span>
                <div><h3>{title}</h3><p>{text}</p></div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section className="offer-section shell" id="offer">
        <div className="offer-card">
          <div className="offer-main">
            <p className="eyebrow dark"><span /> ПЕРВЫЙ ОФФЕР</p>
            <h2>Аудит одной кампании</h2>
            <p>Ограниченный, измеримый проект для первой проверки качества рекламного трафика.</p>
            <ul>
              <li>Согласование формата и критериев</li>
              <li>Анализ OpenRTB или event-выгрузки</li>
              <li>Список источников с объяснением риска</li>
              <li>Excel/CSV и краткое заключение</li>
              <li>Рекомендации для shadow-mode</li>
            </ul>
          </div>
          <div className="offer-price">
            <span>СТАРТОВАЯ СТОИМОСТЬ</span>
            <strong>от 30 000 ₽</strong>
            <p>Точная цена — после проверки формата, периода и объёма данных.</p>
            <a className="button button-dark" href="https://www.fl.ru/users/ifreebadmani/" target="_blank" rel="noreferrer">
              Обсудить задачу <span aria-hidden="true">↗</span>
            </a>
            <small>Без бесплатного анализа полного массива</small>
          </div>
        </div>
      </section>

      <section className="faq shell">
        <div><p className="section-kicker">КОРОТКО О ГЛАВНОМ</p><h2>До начала работы</h2></div>
        <div className="faq-list">
          <details open><summary>Где взять данные для демонстрации?</summary><p>Мы уже используем собственный синтетический набор. Реальные данные появляются только после согласованного заказа и передаются обезличенными.</p></details>
          <details><summary>Сервис сразу блокирует площадки?</summary><p>Нет. Первый этап — offline-аудит, второй — shadow-mode без воздействия на production. Блокировка возможна только после проверки качества правил.</p></details>
          <details><summary>Вы гарантируете, что оставшийся трафик человеческий?</summary><p>Нет. Корректный результат — valid, invalid или unclassified после применённых проверок. Абсолютная гарантия была бы недостоверной.</p></details>
        </div>
      </section>

      <footer>
        <div className="shell footer-inner">
          <div><a className="brand footer-brand" href="#top"><span className="brand-mark"><i /><i /><i /></span><span>IVT GUARD</span></a><p>Defensive OpenRTB quality control.</p></div>
          <div className="footer-links"><a href="https://github.com/free-bad-Man/SaaS" target="_blank" rel="noreferrer">GitHub ↗</a><a href="https://www.fl.ru/users/ifreebadmani/" target="_blank" rel="noreferrer">FL.ru ↗</a></div>
          <span className="footer-note">Internal codename: 3ve.4 Defense Lab</span>
        </div>
      </footer>
    </main>
  );
}
