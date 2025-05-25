describe('IVOD Detail Page', () => {
  beforeEach(() => {
    // Intercept API calls to mock data
    cy.intercept('GET', '/api/ivods/*', {
      statusCode: 200,
      body: {
        data: {
          ivod_id: 123,
          meeting_name: 'Test Meeting',
          date: '2023-01-01',
          speaker_name: 'Test Speaker',
          committee_names: ['Test Committee'],
          video_length: '30:00',
          video_url: null,
          ivod_url: 'https://example.com/ivod/123',
          ai_transcript: 'This is a test AI transcript content.',
          ly_transcript: 'This is a test Legislative Yuan transcript content.',
        }
      }
    }).as('getIvodDetail');
    
    cy.visit('/ivod/123');
  });

  it('renders IVOD details correctly', () => {
    cy.wait('@getIvodDetail');
    
    cy.contains('Test Meeting').should('be.visible');
    cy.contains('2023-01-01').should('be.visible');
    cy.contains('Test Speaker').should('be.visible');
    cy.contains('Test Committee').should('be.visible');
    cy.contains('30:00').should('be.visible');
  });

  it('shows video placeholder when no video URL', () => {
    cy.wait('@getIvodDetail');
    
    cy.contains('影片播放').should('be.visible');
    cy.contains('影片尚未提供').should('be.visible');
  });

  it('can switch between AI and LY transcripts', () => {
    cy.wait('@getIvodDetail');
    
    // Should show AI transcript by default - check the text content
    cy.get('pre.whitespace-pre-wrap').should('contain', 'This is a test AI transcript content.');
    
    // Switch to LY transcript
    cy.contains('立院逐字稿').click();
    cy.get('pre.whitespace-pre-wrap').should('contain', 'This is a test Legislative Yuan transcript content.');
    
    // Switch back to AI transcript
    cy.contains('AI 逐字稿').click();
    cy.get('pre.whitespace-pre-wrap').should('contain', 'This is a test AI transcript content.');
  });

  it('renders external links correctly', () => {
    cy.wait('@getIvodDetail');
    
    cy.get('a[href="https://example.com/ivod/123"]')
      .should('have.attr', 'target', '_blank')
      .contains('查看原始IVOD');
    
    cy.get('a[href="https://dataly.openfun.app/collection/item/ivod/123"]')
      .should('have.attr', 'target', '_blank')
      .contains('在 Dataly 查看');
  });

  it('has a back to list link', () => {
    cy.wait('@getIvodDetail');
    
    cy.get('a[href="/"]').contains('返回列表').should('be.visible');
  });

  it('handles missing transcripts gracefully', () => {
    // Override the intercept for this test
    cy.intercept('GET', '/api/ivods/*', {
      statusCode: 200,
      body: {
        data: {
          ivod_id: 124,
          meeting_name: 'Test Meeting No Transcripts',
          date: '2023-01-01',
          speaker_name: 'Test Speaker',
          committee_names: ['Test Committee'],
          video_length: '30:00',
          video_url: null,
          ivod_url: 'https://example.com/ivod/124',
          ai_transcript: null,
          ly_transcript: null,
        }
      }
    }).as('getIvodDetailNoTranscripts');
    
    cy.visit('/ivod/124');
    cy.wait('@getIvodDetailNoTranscripts');
    
    cy.contains('AI 逐字稿尚未提供').should('exist');
    
    cy.contains('立院逐字稿').click();
    cy.contains('立院逐字稿尚未提供').should('exist');
  });
});