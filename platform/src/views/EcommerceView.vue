<template>
  <section class="ecom-empty">
    <div class="ecom-frame">
      <span class="ecom-badge">MODULE // COMMERCE</span>
      <div class="ecom-glyph"><UiIcon name="cart" :size="40" /></div>
      <h1>Проекты</h1>
      <p>
        Модуль коммерческих проектов отключён. Операции здесь приостановлены до
        следующего релиза платформы.
      </p>
      <div class="ecom-status">
        <span class="ecom-led"></span>
        <span>SECTOR // STANDBY</span>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts"></script>

<style scoped>
.ecom-empty {
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background:
    radial-gradient(1200px 500px at 50% -10%, rgba(34, 211, 238, 0.06), transparent 60%),
    var(--surface-0);
  color: var(--fg-primary);
}
.ecom-frame {
  max-width: 460px;
  width: 100%;
  text-align: center;
  border: 1px solid var(--border-default);
  background: var(--surface-1);
  padding: 40px 32px;
  position: relative;
}
.ecom-badge {
  display: inline-block;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 1.5px;
  color: var(--fg-muted);
  border: 1px solid var(--border-default);
  padding: 2px 8px;
  margin-bottom: 20px;
}
.ecom-glyph {
  width: 72px;
  height: 72px;
  margin: 0 auto 18px;
  display: flex;
  align-items: center;
  justify-content: center;
  border: 1px solid var(--border-strong);
  color: var(--accent);
  background: color-mix(in srgb, var(--accent) 8%, transparent);
  border-radius: 4px;
}
.ecom-frame h1 {
  margin: 0 0 8px;
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 700;
  letter-spacing: 1px;
}
.ecom-frame p {
  margin: 0 auto 22px;
  font-size: 12px;
  line-height: 1.6;
  color: var(--fg-muted);
  max-width: 360px;
}
.ecom-status {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  font-family: var(--font-mono);
  font-size: 9px;
  letter-spacing: 1.5px;
  color: var(--status-warning);
}
.ecom-led {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--status-warning);
  box-shadow: 0 0 8px rgba(251, 191, 36, 0.6);
  animation: ecomPulse 2s ease-in-out infinite;
}
@keyframes ecomPulse {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}
</style>