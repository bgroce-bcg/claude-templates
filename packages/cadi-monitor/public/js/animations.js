// CADI Monitor Animations with GSAP
// Whimsical, productive animations that add personality to the UI

class AnimationController {
  constructor() {
    this.isGSAPLoaded = typeof gsap !== 'undefined';

    if (!this.isGSAPLoaded) {
      console.warn('GSAP not loaded - animations disabled');
      return;
    }

    // Configure GSAP defaults for smooth, snappy animations
    gsap.defaults({
      ease: 'power2.out',
      duration: 0.4
    });

    this.init();
  }

  init() {
    if (!this.isGSAPLoaded) return;

    // Setup hover effects for interactive elements
    this.setupButtonInteractions();

    // Animate connection status changes
    this.watchConnectionStatus();
  }

  /**
   * Animate cards entering the view with stagger effect
   * Creates a cascading entrance animation
   */
  animateCardsIn(selector, options = {}) {
    if (!this.isGSAPLoaded) return;

    const cards = document.querySelectorAll(selector);
    if (cards.length === 0) return;

    const defaults = {
      stagger: 0.05,
      duration: 0.5,
      ease: 'back.out(1.2)',
      clearProps: 'all' // Clean up inline styles after animation
    };

    const settings = { ...defaults, ...options };

    // Set initial state
    gsap.set(cards, {
      opacity: 0,
      y: 20,
      scale: 0.95
    });

    // Animate in with stagger
    gsap.to(cards, {
      opacity: 1,
      y: 0,
      scale: 1,
      duration: settings.duration,
      stagger: settings.stagger,
      ease: settings.ease,
      clearProps: settings.clearProps
    });
  }

  /**
   * Animate project cards with a fun bounce
   */
  animateProjectCards() {
    this.animateCardsIn('.project-card', {
      ease: 'elastic.out(1, 0.6)',
      duration: 0.8
    });
  }

  /**
   * Animate agent cards - more serious, productivity focused
   */
  animateAgentCards() {
    this.animateCardsIn('.agent-card', {
      stagger: 0.03,
      ease: 'power3.out'
    });
  }

  /**
   * Animate error items sliding in from the right
   */
  animateErrorItems() {
    if (!this.isGSAPLoaded) return;

    const errors = document.querySelectorAll('.error-item');
    if (errors.length === 0) return;

    gsap.set(errors, {
      opacity: 0,
      x: 30,
      scale: 0.98
    });

    gsap.to(errors, {
      opacity: 1,
      x: 0,
      scale: 1,
      duration: 0.4,
      stagger: 0.04,
      ease: 'power2.out',
      clearProps: 'all'
    });
  }

  /**
   * Animate feature cards expanding
   */
  animateFeatureCards() {
    this.animateCardsIn('.feature-card', {
      ease: 'power2.out',
      stagger: 0.04
    });
  }

  /**
   * Animate sections list expanding with smooth height transition
   */
  animateSectionsExpand(element) {
    if (!this.isGSAPLoaded || !element) return;

    const sections = element.querySelectorAll('.section-item');

    // Animate container height
    gsap.from(element, {
      height: 0,
      duration: 0.4,
      ease: 'power2.out'
    });

    // Animate sections sliding in
    gsap.from(sections, {
      opacity: 0,
      x: -20,
      duration: 0.3,
      stagger: 0.05,
      ease: 'power2.out'
    });
  }

  /**
   * Animate sections list collapsing
   */
  animateSectionsCollapse(element, onComplete) {
    if (!this.isGSAPLoaded || !element) {
      if (onComplete) onComplete();
      return;
    }

    gsap.to(element, {
      height: 0,
      opacity: 0,
      duration: 0.3,
      ease: 'power2.in',
      onComplete
    });
  }

  /**
   * Animate context document cards
   */
  animateContextDocs() {
    this.animateCardsIn('.context-doc', {
      stagger: 0.04,
      ease: 'back.out(1.1)'
    });
  }

  /**
   * Animate context load cards
   */
  animateContextLoads() {
    this.animateCardsIn('.context-load-card', {
      stagger: 0.03
    });
  }

  /**
   * Animate activity feed items appearing
   */
  animateActivityItems() {
    if (!this.isGSAPLoaded) return;

    const items = document.querySelectorAll('.activity-item');
    if (items.length === 0) return;

    gsap.set(items, {
      opacity: 0,
      x: -30
    });

    gsap.to(items, {
      opacity: 1,
      x: 0,
      duration: 0.3,
      stagger: 0.02,
      ease: 'power2.out',
      clearProps: 'all'
    });
  }

  /**
   * Animate stats cards with a subtle scale effect
   */
  animateStatsCards() {
    this.animateCardsIn('.stat-card, .error-stat-card, .agent-stat-card', {
      stagger: 0.06,
      ease: 'back.out(1.3)',
      duration: 0.6
    });
  }

  /**
   * Animate view transitions
   */
  animateViewChange(oldView, newView) {
    if (!this.isGSAPLoaded) return;

    const timeline = gsap.timeline();

    // Fade out old view
    if (oldView) {
      timeline.to(oldView, {
        opacity: 0,
        y: -10,
        duration: 0.2,
        ease: 'power2.in'
      });
    }

    // Fade in new view
    if (newView) {
      timeline.fromTo(newView,
        {
          opacity: 0,
          y: 10
        },
        {
          opacity: 1,
          y: 0,
          duration: 0.3,
          ease: 'power2.out'
        },
        '-=0.1' // Overlap slightly for smooth transition
      );
    }
  }

  /**
   * Animate modal opening with scale + fade
   */
  animateModalOpen(modal) {
    if (!this.isGSAPLoaded) return;

    const content = modal.querySelector('.modal-content');

    gsap.set(modal, { display: 'flex' });

    const timeline = gsap.timeline();

    // Fade in backdrop
    timeline.fromTo(modal,
      { opacity: 0 },
      { opacity: 1, duration: 0.2, ease: 'power2.out' }
    );

    // Scale + fade modal content with a playful bounce
    timeline.fromTo(content,
      {
        opacity: 0,
        scale: 0.9,
        y: -20
      },
      {
        opacity: 1,
        scale: 1,
        y: 0,
        duration: 0.4,
        ease: 'back.out(1.5)'
      },
      '-=0.15'
    );
  }

  /**
   * Animate modal closing
   */
  animateModalClose(modal, onComplete) {
    if (!this.isGSAPLoaded) {
      if (onComplete) onComplete();
      return;
    }

    const content = modal.querySelector('.modal-content');
    const timeline = gsap.timeline({
      onComplete: () => {
        gsap.set(modal, { display: 'none' });
        if (onComplete) onComplete();
      }
    });

    // Scale down + fade content
    timeline.to(content, {
      opacity: 0,
      scale: 0.95,
      y: -10,
      duration: 0.25,
      ease: 'power2.in'
    });

    // Fade out backdrop
    timeline.to(modal, {
      opacity: 0,
      duration: 0.15,
      ease: 'power2.in'
    }, '-=0.1');
  }

  /**
   * Celebrate completion with a subtle pop animation
   */
  celebrateCompletion(element) {
    if (!this.isGSAPLoaded || !element) return;

    const timeline = gsap.timeline();

    // Quick scale up
    timeline.to(element, {
      scale: 1.05,
      duration: 0.15,
      ease: 'power2.out'
    });

    // Elastic bounce back
    timeline.to(element, {
      scale: 1,
      duration: 0.5,
      ease: 'elastic.out(1, 0.5)'
    });

    // Add a subtle color flash effect
    const originalBg = window.getComputedStyle(element).backgroundColor;
    timeline.to(element, {
      backgroundColor: 'rgba(46, 160, 67, 0.1)',
      duration: 0.3,
      ease: 'power2.out'
    }, 0);

    timeline.to(element, {
      backgroundColor: originalBg,
      duration: 0.5,
      ease: 'power2.out'
    });
  }

  /**
   * Pulse animation for new items (like new errors or agent invocations)
   */
  pulseNewItem(element) {
    if (!this.isGSAPLoaded || !element) return;

    gsap.fromTo(element,
      {
        scale: 1,
        boxShadow: '0 0 0 0 rgba(59, 130, 246, 0.4)'
      },
      {
        scale: 1,
        boxShadow: '0 0 0 10px rgba(59, 130, 246, 0)',
        duration: 0.8,
        ease: 'power2.out'
      }
    );
  }

  /**
   * Setup interactive button hover effects
   */
  setupButtonInteractions() {
    if (!this.isGSAPLoaded) return;

    // Add subtle lift on hover for all buttons
    const buttons = document.querySelectorAll('.btn-primary, .btn-secondary, .btn-danger, .btn-icon');

    buttons.forEach(button => {
      button.addEventListener('mouseenter', () => {
        gsap.to(button, {
          y: -2,
          duration: 0.2,
          ease: 'power2.out'
        });
      });

      button.addEventListener('mouseleave', () => {
        gsap.to(button, {
          y: 0,
          duration: 0.2,
          ease: 'power2.out'
        });
      });

      // Add a little "press" effect
      button.addEventListener('mousedown', () => {
        gsap.to(button, {
          scale: 0.95,
          duration: 0.1,
          ease: 'power2.out'
        });
      });

      button.addEventListener('mouseup', () => {
        gsap.to(button, {
          scale: 1,
          duration: 0.15,
          ease: 'back.out(2)'
        });
      });
    });
  }

  /**
   * Animate card hover effects
   */
  setupCardHoverEffects() {
    if (!this.isGSAPLoaded) return;

    const setupHover = (selector) => {
      document.addEventListener('mouseover', (e) => {
        const card = e.target.closest(selector);
        if (!card) return;

        gsap.to(card, {
          y: -4,
          boxShadow: '0 8px 24px rgba(0, 0, 0, 0.15)',
          duration: 0.3,
          ease: 'power2.out'
        });
      });

      document.addEventListener('mouseout', (e) => {
        const card = e.target.closest(selector);
        if (!card) return;

        gsap.to(card, {
          y: 0,
          boxShadow: '0 1px 3px rgba(0, 0, 0, 0.1)',
          duration: 0.3,
          ease: 'power2.out'
        });
      });
    };

    setupHover('.project-card');
    setupHover('.agent-card');
    setupHover('.feature-card');
    setupHover('.context-doc');
  }

  /**
   * Watch connection status for animated changes
   */
  watchConnectionStatus() {
    if (!this.isGSAPLoaded) return;

    const statusIndicator = document.querySelector('.status-indicator');
    if (!statusIndicator) return;

    // Create observer to watch for class changes
    const observer = new MutationObserver((mutations) => {
      mutations.forEach((mutation) => {
        if (mutation.attributeName === 'class') {
          const isConnected = statusIndicator.classList.contains('connected');

          if (isConnected) {
            // Celebration animation when connected
            gsap.fromTo(statusIndicator,
              { scale: 0.8 },
              {
                scale: 1,
                duration: 0.6,
                ease: 'elastic.out(1, 0.5)'
              }
            );
          } else {
            // Gentle pulse when disconnected
            gsap.to(statusIndicator, {
              scale: 1,
              duration: 0.3,
              ease: 'power2.out'
            });
          }
        }
      });
    });

    observer.observe(statusIndicator, { attributes: true });
  }

  /**
   * Shimmer loading effect for skeleton states
   */
  createShimmerEffect(element) {
    if (!this.isGSAPLoaded || !element) return;

    const shimmer = document.createElement('div');
    shimmer.className = 'shimmer-overlay';
    element.style.position = 'relative';
    element.style.overflow = 'hidden';
    element.appendChild(shimmer);

    gsap.to(shimmer, {
      x: '100%',
      duration: 1.5,
      ease: 'power1.inOut',
      repeat: -1
    });
  }

  /**
   * Animate number changes (for stats)
   */
  animateNumber(element, newValue, duration = 0.8) {
    if (!this.isGSAPLoaded || !element) return;

    const oldValue = parseInt(element.textContent) || 0;

    gsap.to({ value: oldValue }, {
      value: newValue,
      duration: duration,
      ease: 'power2.out',
      onUpdate: function() {
        element.textContent = Math.round(this.targets()[0].value);
      }
    });
  }

  /**
   * Confetti burst effect for major achievements
   * (Optional - can be enabled for special occasions)
   */
  celebrateWithConfetti(x, y) {
    if (!this.isGSAPLoaded) return;

    const colors = ['#2ea043', '#3178c6', '#f59e0b', '#8b5cf6'];
    const confettiCount = 30;

    for (let i = 0; i < confettiCount; i++) {
      const confetti = document.createElement('div');
      confetti.style.position = 'fixed';
      confetti.style.left = x + 'px';
      confetti.style.top = y + 'px';
      confetti.style.width = '8px';
      confetti.style.height = '8px';
      confetti.style.backgroundColor = colors[Math.floor(Math.random() * colors.length)];
      confetti.style.borderRadius = '50%';
      confetti.style.pointerEvents = 'none';
      confetti.style.zIndex = '10000';
      document.body.appendChild(confetti);

      const angle = (Math.PI * 2 * i) / confettiCount;
      const velocity = 100 + Math.random() * 100;
      const tx = Math.cos(angle) * velocity;
      const ty = Math.sin(angle) * velocity;

      gsap.to(confetti, {
        x: tx,
        y: ty + 200, // Add gravity
        opacity: 0,
        duration: 1 + Math.random() * 0.5,
        ease: 'power2.out',
        onComplete: () => confetti.remove()
      });
    }
  }

  /**
   * Smooth scroll to element
   */
  scrollToElement(element, offset = 0) {
    if (!this.isGSAPLoaded || !element) return;

    const y = element.getBoundingClientRect().top + window.pageYOffset + offset;

    gsap.to(window, {
      scrollTo: { y: y, autoKill: false },
      duration: 0.6,
      ease: 'power2.inOut'
    });
  }

  /**
   * Rotate refresh icon with elastic effect
   */
  animateRefreshIcon(iconElement) {
    if (!this.isGSAPLoaded || !iconElement) return;

    gsap.to(iconElement, {
      rotation: '+=360',
      duration: 0.6,
      ease: 'back.out(1.2)'
    });
  }

  /**
   * Tab switching animation
   */
  animateTabSwitch(oldTab, newTab) {
    if (!this.isGSAPLoaded) return;

    const timeline = gsap.timeline();

    // Animate indicator movement (if there's an active indicator)
    if (oldTab && newTab) {
      const indicator = document.createElement('div');
      indicator.style.position = 'absolute';
      indicator.style.bottom = '0';
      indicator.style.height = '2px';
      indicator.style.backgroundColor = 'var(--accent)';
      indicator.style.transition = 'none';

      const oldRect = oldTab.getBoundingClientRect();
      const newRect = newTab.getBoundingClientRect();

      indicator.style.left = oldRect.left + 'px';
      indicator.style.width = oldRect.width + 'px';

      oldTab.parentElement.appendChild(indicator);

      timeline.to(indicator, {
        left: newRect.left,
        width: newRect.width,
        duration: 0.3,
        ease: 'power2.inOut',
        onComplete: () => indicator.remove()
      });
    }

    // Subtle scale effect on new tab
    if (newTab) {
      timeline.fromTo(newTab,
        { scale: 0.95 },
        { scale: 1, duration: 0.2, ease: 'back.out(2)' },
        '-=0.2'
      );
    }
  }

  /**
   * Floating animation for decorative elements
   */
  createFloatingAnimation(element, duration = 3) {
    if (!this.isGSAPLoaded || !element) return;

    gsap.to(element, {
      y: '+=10',
      duration: duration,
      ease: 'sine.inOut',
      repeat: -1,
      yoyo: true
    });
  }
}

// Create global instance
window.animationController = new AnimationController();
