const assert = require('node:assert/strict');
const {
  selectHeroImageCandidate,
  classifyHeroImageCandidate,
} = require('./ingest_fb_event');

function testSoftFallbackPosterSelected() {
  const result = selectHeroImageCandidate({
    fbEvent: {
      cover: {
        source: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/12345_n.jpg',
        width: 640,
        height: 360,
      },
    },
    ogMeta: {
      image: 'https://example.com/assets/logo.png',
      imageWidth: 120,
      imageHeight: 120,
    },
  });

  assert.equal(result.selected?.source, 'facebook_cover');
  assert.equal(result.selectedReason, 'soft_fallback_small_cover');
}

function testLogoAndIconRemainRejected() {
  const logo = classifyHeroImageCandidate({
    url: 'https://example.com/static/logo-header.png',
    source: 'og:image',
    width: 900,
    height: 450,
  });
  const icon = classifyHeroImageCandidate({
    url: 'https://example.com/favicon/icon-192.png',
    source: 'og:image',
    width: 192,
    height: 192,
  });

  assert.equal(logo.hardRejected, true);
  assert.equal(icon.hardRejected, true);
}

function testFacebookMediumPreviewChosen() {
  const result = selectHeroImageCandidate({
    fbEvent: {
      cover: {
        source: 'https://scontent.xx.fbcdn.net/v/t39.30808-6/preview.jpg?stp=dst-jpg_s640x640',
        width: 640,
        height: 360,
      },
    },
  });

  assert.equal(result.selected?.source, 'facebook_cover');
  assert.equal(result.selectedReason, 'soft_fallback_small_cover');
}

function testOgImageChosenWhenOnlyNonJunk() {
  const result = selectHeroImageCandidate({
    ogMeta: {
      image: 'https://eventsite.example.com/media/event-poster.jpg',
      imageWidth: 1200,
      imageHeight: 630,
      images: [
        {
          url: 'https://eventsite.example.com/media/icon-square.png',
          width: 120,
          height: 120,
        },
      ],
    },
  });

  assert.equal(result.selected?.url, 'https://eventsite.example.com/media/event-poster.jpg');
  assert.equal(result.selectedReason, 'best_non_rejected');
}

function testNoImageWhenAllJunk() {
  const result = selectHeroImageCandidate({
    ogMeta: {
      image: 'https://example.com/logo.png',
      imageWidth: 160,
      imageHeight: 160,
      images: [
        'https://example.com/assets/sprite-sheet.png',
        'https://example.com/profile/avatar.jpg',
      ],
    },
  });

  assert.equal(result.selected, null);
  assert.equal(result.selectedReason, 'rejected_all_candidates');
}

function run() {
  testSoftFallbackPosterSelected();
  testLogoAndIconRemainRejected();
  testFacebookMediumPreviewChosen();
  testOgImageChosenWhenOnlyNonJunk();
  testNoImageWhenAllJunk();
  console.log('ingest_fb_event hero selection regressions: ok');
}

run();
