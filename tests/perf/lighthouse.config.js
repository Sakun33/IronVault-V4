module.exports = {
  ci: {
    collect: {
      url: ['http://localhost:5000', 'http://localhost:3000/admin-console-simple.html'],
      numberOfRuns: 3
    },
    assert: {
      assertions: {
        'categories:performance': ['warn', { minScore: 0.85 }],
        'categories:accessibility': ['error', { minScore: 0.9 }],
        'categories:best-practices': ['warn', { minScore: 0.9 }],
        'categories:seo': ['warn', { minScore: 0.8 }],
        'categories:pwa': ['warn', { minScore: 0.9 }]
      }
    },
    upload: {
      target: 'filesystem',
      outputDir: './reports/lhci'
    }
  }
}
