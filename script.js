// Scroll-based section reveal
const sections = document.querySelectorAll('.section');
const observer = new IntersectionObserver(
  (entries) => entries.forEach(e => { if (e.isIntersecting) e.target.classList.add('visible'); }),
  { threshold: 0.08 }
);
sections.forEach(s => observer.observe(s));

// Active nav link on scroll
const navLinks = document.querySelectorAll('.nav-link');
const sectionEls = document.querySelectorAll('section[id]');

const navObserver = new IntersectionObserver(
  (entries) => {
    entries.forEach(e => {
      if (e.isIntersecting) {
        navLinks.forEach(l => l.classList.remove('active'));
        const active = document.querySelector(`.nav-link[data-section="${e.target.id}"]`);
        if (active) active.classList.add('active');
      }
    });
  },
  { threshold: 0.4 }
);
sectionEls.forEach(s => navObserver.observe(s));

// Smooth navbar scroll shadow
const navbar = document.getElementById('navbar');
window.addEventListener('scroll', () => {
  navbar.style.boxShadow = window.scrollY > 20 ? '0 4px 24px rgba(0,0,0,0.5)' : 'none';
}, { passive: true });

// Search toggle
const searchToggle = document.getElementById('searchToggle');
const searchInput = document.getElementById('searchInput');
searchToggle.addEventListener('click', () => {
  searchInput.classList.toggle('open');
  if (searchInput.classList.contains('open')) searchInput.focus();
});
searchInput.addEventListener('blur', () => searchInput.classList.remove('open'));
