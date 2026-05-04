/* ═══════════════════════════════════════════════════════════════════════════
   Dynamic Content Loader — Heart Warriors CMS
   Loads all editable content from API and injects into pages
   ═══════════════════════════════════════════════════════════════════════════ */

(function() {
  const params = new URLSearchParams(window.location.search);
  const isPreview = params.get('_preview') === '1';

  function set(id, val) {
    const el = document.getElementById(id);
    if (el && val) el.textContent = val;
  }

  function setHTML(id, val) {
    const el = document.getElementById(id);
    if (el && val) el.innerHTML = val;
  }

  function setAttr(id, attr, val) {
    const el = document.getElementById(id);
    if (el && val) el.setAttribute(attr, val);
  }

  function setCounter(id, val, suffix) {
    const el = document.getElementById(id);
    if (!el || !val) return;
    el.dataset.target = val;
    el.dataset.suffix = suffix || '';
  }

  function setCoreValues(id, val) {
    const el = document.getElementById(id);
    if (!el || !val) return;
    el.innerHTML = val.split('\n').filter(Boolean).map(line => {
      return line.replace(/^([^—–-]+[—–-])/, '<strong>$1</strong>');
    }).join('<br><br>');
  }

  function applyContent(s) {
    // Navigation & Header
    set('dyn-brand-name', s.brand_name);
    set('dyn-brand-tagline', s.brand_tagline);
    set('dyn-nav-home', s.nav_home);
    set('dyn-nav-about', s.nav_about);
    set('dyn-nav-news', s.nav_news);
    set('dyn-nav-events', s.nav_events);
    set('dyn-nav-gallery', s.nav_gallery);
    set('dyn-nav-contact', s.nav_contact);
    set('dyn-nav-cta', s.nav_cta_text);
    set('dyn-topbar-text1', s.topbar_text1);
    set('dyn-topbar-text2', s.topbar_text2);

    // Hero
    set('dyn-hero-badge', s.hero_badge);
    set('dyn-hero-title-line1', s.hero_title_line1);
    set('dyn-hero-title-highlight', s.hero_title_highlight);
    set('dyn-hero-title-line2', s.hero_title_line2);
    set('dyn-hero-description', s.hero_description);
    if (s.hero_btn1_text) { const el = document.getElementById('dyn-hero-btn1'); if(el) el.textContent = s.hero_btn1_text; }
    if (s.hero_btn2_text) { const el = document.getElementById('dyn-hero-btn2'); if(el) el.textContent = s.hero_btn2_text; }
    set('dyn-card-title', s.hero_card_title);
    set('dyn-card-subtitle', s.hero_card_subtitle);
    set('dyn-tag1', s.hero_tag1);
    set('dyn-tag2', s.hero_tag2);
    set('dyn-tag3', s.hero_tag3);

    // Stats
    setCounter('dyn-stat1-num', s.stat1_value, s.stat1_suffix); set('dyn-stat1-label', s.stat1_label);
    setCounter('dyn-stat2-num', s.stat2_value, s.stat2_suffix); set('dyn-stat2-label', s.stat2_label);
    setCounter('dyn-stat3-num', s.stat3_value, s.stat3_suffix); set('dyn-stat3-label', s.stat3_label);
    setCounter('dyn-stat4-num', s.stat4_value, s.stat4_suffix); set('dyn-stat4-label', s.stat4_label);
    setCounter('dyn-hero-stat1-num', s.stat1_value, s.stat1_suffix); set('dyn-hero-stat1-label', s.stat1_label);
    setCounter('dyn-hero-stat2-num', s.stat2_value, s.stat2_suffix); set('dyn-hero-stat2-label', s.stat2_label);
    setCounter('dyn-hero-stat4-num', s.stat4_value, s.stat4_suffix); set('dyn-hero-stat4-label', s.stat4_label);

    // Mission & Vision
    set('dyn-mission', s.mission_text);
    set('dyn-vision', s.vision_text);
    setCoreValues('dyn-core-values', s.core_values_text);
    set('dyn-lgu-commitment', s.lgu_commitment_text);

    // About Page
    set('dyn-about-title', s.about_page_title);
    set('dyn-about-desc', s.about_page_desc);
    set('dyn-about-p1', s.about_intro_p1);
    set('dyn-about-p2', s.about_intro_p2);
    set('dyn-about-p3', s.about_intro_p3);
    set('dyn-about-year', s.about_established_year);
    set('dyn-highlight1', s.about_highlight1);
    set('dyn-highlight2', s.about_highlight2);
    set('dyn-highlight3', s.about_highlight3);
    set('dyn-highlight4', s.about_highlight4);
    
    // Services
    for (let i = 1; i <= 6; i++) {
      set(`dyn-service${i}-icon`, s[`service${i}_icon`]);
      set(`dyn-service${i}-title`, s[`service${i}_title`]);
      set(`dyn-service${i}-desc`, s[`service${i}_desc`]);
    }

    // Contact Page
    set('dyn-contact-title', s.contact_page_title);
    set('dyn-contact-desc', s.contact_page_desc);
    set('dyn-contact-hours', s.contact_office_hours);
    setAttr('dyn-form-name', 'placeholder', s.contact_form_name_label);
    setAttr('dyn-form-email', 'placeholder', s.contact_form_email_label);
    setAttr('dyn-form-subject', 'placeholder', s.contact_form_subject_label);
    setAttr('dyn-form-message', 'placeholder', s.contact_form_message_label);
    set('dyn-form-submit', s.contact_form_submit_text);

    // Footer
    set('dyn-footer-desc', s.footer_description);
    set('dyn-footer-section1', s.footer_section1_title);
    set('dyn-footer-section2', s.footer_section2_title);
    set('dyn-footer-section3', s.footer_section3_title);
    set('dyn-footer-copyright', s.footer_copyright);
    setAttr('dyn-social-facebook', 'href', s.social_facebook);
    // Only update href, never innerHTML of topbar email link
    const emailEl = document.getElementById('dyn-social-email');
    if (emailEl && s.social_email) emailEl.setAttribute('href', 'mailto:' + s.social_email);
    set('dyn-social-email-text', s.social_email);
    set('dyn-social-phone', s.social_phone);
  }

  if (isPreview) {
    const s = {};
    params.forEach((v, k) => { if (k !== '_preview') s[k] = v; });
    applyContent(s);
  } else {
    fetch('/api/settings')
      .then(r => r.json())
      .then(json => { if (json.data) applyContent(json.data); })
      .catch(() => {});
  }
})();
