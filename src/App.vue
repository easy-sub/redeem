<script setup>
import PelicanScene from './components/PelicanScene.vue'
</script>

<template>
  <div class="site-shell">
    <header class="site-header">
      <a class="brand" href="/" aria-label="鹈鹕骑行，返回首页">
        <svg class="brand-icon" viewBox="0 0 64 64" role="img" aria-label="鹈鹕图形">
          <rect width="64" height="64" rx="16" fill="#b9e4e3" />
          <path d="M18 45c0-8 4-14 11-17 5-2 10-1 14 2 4 3 6 7 6 13v2H18Z" fill="#fffdf6" stroke="#d8d4c6" stroke-width="2" />
          <path d="M28 31c1-10 6-16 14-17 6-1 10 2 11 7 1 4-1 8-5 11-4 3-10 3-16 1Z" fill="#fffdf6" stroke="#d8d4c6" stroke-width="2" />
          <path d="M42 25c6 0 13 2 18 5-4 3-11 4-17 2l-7-3Z" fill="#f6a52d" stroke="#df8621" stroke-width="1.5" stroke-linejoin="round" />
          <path d="M38 35c5 1 10 1 15-1-2 6-6 9-12 9-3 0-5-2-6-5Z" fill="#ef8b35" />
          <circle cx="42" cy="22" r="2.3" fill="#243238" />
          <circle cx="42.8" cy="21.2" r=".7" fill="#fff" />
          <path d="M25 34c-5 1-9 4-12 8 5 0 10-2 14-5Z" fill="#e63946" />
          <path d="M31 47c4-3 9-4 15-3" fill="none" stroke="#e63946" stroke-width="3" stroke-linecap="round" />
          <path d="M23 17c1-3 3-5 6-6M29 17c2-3 4-4 7-5" fill="none" stroke="#d8d4c6" stroke-width="2" stroke-linecap="round" />
        </svg>
        <span>鹈鹕骑行</span>
      </a>
      <a class="header-link" href="#story">沿途风景 <span aria-hidden="true">↘</span></a>
    </header>

    <main class="home-grid">
      <div class="copy-panel">
        <section class="intro" aria-labelledby="page-title">
          <div class="intro-copy">
            <p class="eyebrow">一场轻松的模型测试</p>
            <h1 id="page-title">鹈鹕骑行</h1>
            <p class="intro-text">给模型一只鹈鹕、一辆单车和一条风景线，看它能不能把想法说清楚，也把画面稳稳地骑起来。</p>
          </div>
          <p class="intro-note">向前骑，快乐就会跟上来。</p>
        </section>

        <section id="story" class="story-section" aria-labelledby="story-title">
          <div class="story-heading">
            <p class="eyebrow">为什么是鹈鹕骑行</p>
            <h2 id="story-title">简单的画面，也能测出模型的状态。</h2>
          </div>
          <div class="story-details">
            <p>“鹈鹕骑行”是一个轻松却不简单的小场景：鹈鹕要骑车，车轮要转，云和树要向后移动，红围巾还要随风摆动。</p>
            <p>它像一只会动的纸飞机，能快速看出模型有没有听懂要求、能不能持续保持细节，以及文字、代码和视觉表达是否还在说同一件事。</p>
          </div>
        </section>
      </div>

      <section class="scene-section" aria-label="鹈鹕骑单车动画">
        <PelicanScene />
      </section>
    </main>

    <footer class="site-footer"><span>鹈鹕骑行</span><span>保持理解，也保持好奇</span></footer>
  </div>
</template>
