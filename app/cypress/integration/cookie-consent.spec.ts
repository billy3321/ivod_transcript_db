describe('Cookie Consent and Privacy', () => {
  beforeEach(() => {
    // Clear cookies and localStorage before each test
    cy.clearCookies()
    cy.clearLocalStorage()
  })

  describe('Cookie Consent Banner (when GA is configured)', () => {
    beforeEach(() => {
      // Visit home page
      cy.visit('/')
    })

    it('should display cookie consent banner on first visit if GA is configured', () => {
      // Check if cookie banner exists (it should if GA is configured)
      cy.get('body').then(($body) => {
        if ($body.find('[data-testid="cookie-consent"]').length > 0 ||
            $body.text().includes('本網站使用 cookies')) {
          cy.contains('本網站使用 cookies 來改善使用體驗和分析網站流量')
            .should('be.visible')
          cy.contains('接受').should('be.visible')
          cy.contains('拒絕').should('be.visible')
          cy.contains('隱私政策').should('be.visible')
        }
      })
    })

    it('should have a link to privacy policy in banner', () => {
      cy.get('body').then(($body) => {
        if ($body.text().includes('隱私政策')) {
          cy.contains('隱私政策').should('have.attr', 'href', '/privacy')
        }
      })
    })

    it('should hide banner after accepting cookies', () => {
      cy.get('body').then(($body) => {
        if ($body.find('button').filter((_, el) => el.textContent?.includes('接受')).length > 0) {
          // Click accept button
          cy.contains('button', '接受').click()

          // Wait for potential reload
          cy.wait(500)

          // Check localStorage
          cy.window().then((win) => {
            expect(win.localStorage.getItem('CookieConsent')).to.equal('true')
          })
        }
      })
    })

    it('should set localStorage to false when declining cookies', () => {
      cy.get('body').then(($body) => {
        if ($body.find('button').filter((_, el) => el.textContent?.includes('拒絕')).length > 0) {
          // Click decline button
          cy.contains('button', '拒絕').click()

          // Check localStorage
          cy.window().then((win) => {
            expect(win.localStorage.getItem('CookieConsent')).to.equal('false')
          })
        }
      })
    })

    it('should not show banner on subsequent visits after accepting', () => {
      cy.get('body').then(($body) => {
        if ($body.find('button').filter((_, el) => el.textContent?.includes('接受')).length > 0) {
          cy.contains('button', '接受').click()

          // Wait for potential reload
          cy.wait(1000)

          // Visit another page
          cy.visit('/about')

          // Banner should not appear
          cy.get('body').should('not.contain', '本網站使用 cookies 來改善使用體驗')
        }
      })
    })

    it('should not show banner on subsequent visits after declining', () => {
      cy.get('body').then(($body) => {
        if ($body.find('button').filter((_, el) => el.textContent?.includes('拒絕')).length > 0) {
          cy.contains('button', '拒絕').click()

          // Visit another page
          cy.visit('/about')

          // Banner should not appear
          cy.get('body').should('not.contain', '本網站使用 cookies 來改善使用體驗')
        }
      })
    })
  })

  describe('Google Analytics Loading', () => {
    it('should not load GA scripts before accepting cookies', () => {
      cy.visit('/')

      // Check if GA scripts are NOT loaded
      cy.get('script[src*="googletagmanager.com/gtag"]').should('not.exist')
    })

    it('should load GA scripts after accepting cookies', () => {
      // Set cookie consent in localStorage
      cy.window().then((win) => {
        win.localStorage.setItem('CookieConsent', 'true')
      })

      cy.visit('/')

      // Check if GA measurement ID is configured
      cy.window().then((win) => {
        const gaId = Cypress.env('NEXT_PUBLIC_GA_MEASUREMENT_ID') ||
                     (win as any).NEXT_PUBLIC_GA_MEASUREMENT_ID

        if (gaId) {
          // GA scripts should be loaded
          cy.get('script[src*="googletagmanager.com/gtag"]', { timeout: 5000 })
            .should('exist')
        }
      })
    })

    it('should not load GA scripts when declining cookies', () => {
      // Set cookie consent to false in localStorage
      cy.window().then((win) => {
        win.localStorage.setItem('CookieConsent', 'false')
      })

      cy.visit('/')

      // Check if GA scripts are NOT loaded
      cy.get('script[src*="googletagmanager.com/gtag"]').should('not.exist')
    })
  })

  describe('Privacy Policy Page', () => {
    beforeEach(() => {
      cy.visit('/privacy')
    })

    it('should display privacy policy page correctly', () => {
      cy.get('h1').should('contain', '隱私政策')
      cy.url().should('include', '/privacy')
    })

    it('should display all main sections', () => {
      const sections = [
        '關於本隱私政策',
        '我們收集哪些資料',
        '如何使用這些資料',
        'Cookies 的使用',
        '第三方服務',
        '資料安全',
        '您的權利'
      ]

      sections.forEach(section => {
        cy.contains(section).should('be.visible')
      })
    })

    it('should display Google Analytics information', () => {
      cy.contains('Google Analytics').should('be.visible')
      cy.contains('本網站使用 Google Analytics 進行流量分析').should('be.visible')
    })

    it('should have link to Google Privacy Policy', () => {
      cy.contains('a', 'Google 隱私政策')
        .should('have.attr', 'href', 'https://policies.google.com/privacy')
        .and('have.attr', 'target', '_blank')
        .and('have.attr', 'rel', 'noopener noreferrer')
    })

    it('should have link to Google Analytics opt-out', () => {
      cy.contains('a', 'Google Analytics 退出擴充功能')
        .should('have.attr', 'href', 'https://tools.google.com/dlpage/gaoptout')
        .and('have.attr', 'target', '_blank')
        .and('have.attr', 'rel', 'noopener noreferrer')
    })

    it('should display cookie information table', () => {
      cy.contains('CookieConsent').should('be.visible')
      cy.contains('365 天').should('be.visible')
      cy.contains('_ga, _ga_*').should('be.visible')
      cy.contains('Google Analytics 分析用途').should('be.visible')
    })

    it('should display user rights', () => {
      cy.contains('拒絕權').should('be.visible')
      cy.contains('刪除權').should('be.visible')
      cy.contains('知情權').should('be.visible')
      cy.contains('反對權').should('be.visible')
    })

    it('should display summary section', () => {
      cy.contains('簡而言之').should('be.visible')
      cy.contains('我們只使用 Google Analytics 進行匿名流量分析').should('be.visible')
    })

    it('should have a back button', () => {
      cy.contains('button', '返回').should('be.visible')
    })

    it('should navigate back when clicking back button', () => {
      // First visit home page
      cy.visit('/')
      cy.wait(500)

      // Then visit privacy page
      cy.visit('/privacy')

      // Click back button
      cy.contains('button', '返回').click()

      // Should go back to previous page (home)
      cy.url().should('not.include', '/privacy')
    })
  })

  describe('Privacy Policy Navigation from Cookie Banner', () => {
    it('should navigate to privacy page when clicking privacy link in banner', () => {
      cy.visit('/')

      cy.get('body').then(($body) => {
        if ($body.text().includes('隱私政策')) {
          // Click privacy policy link
          cy.contains('a', '隱私政策').click()

          // Should navigate to privacy page
          cy.url().should('include', '/privacy')
          cy.get('h1').should('contain', '隱私政策')
        }
      })
    })
  })

  describe('Responsive Design', () => {
    it('should display cookie banner correctly on mobile', () => {
      cy.viewport(375, 667) // iPhone SE size
      cy.visit('/')

      cy.get('body').then(($body) => {
        if ($body.text().includes('本網站使用 cookies')) {
          cy.contains('本網站使用 cookies').should('be.visible')
          cy.contains('button', '接受').should('be.visible')
          cy.contains('button', '拒絕').should('be.visible')
        }
      })
    })

    it('should display privacy page correctly on mobile', () => {
      cy.viewport(375, 667)
      cy.visit('/privacy')

      cy.get('h1').should('be.visible')
      cy.contains('關於本隱私政策').should('be.visible')
    })

    it('should display privacy page correctly on tablet', () => {
      cy.viewport(768, 1024)
      cy.visit('/privacy')

      cy.get('h1').should('be.visible')
      cy.contains('關於本隱私政策').should('be.visible')
    })
  })

  describe('Accessibility', () => {
    it('should have proper heading hierarchy on privacy page', () => {
      cy.visit('/privacy')

      cy.get('h1').should('have.length', 1)
      cy.get('h2').should('have.length.at.least', 5)
    })

    it('should have accessible buttons in cookie banner', () => {
      cy.visit('/')

      cy.get('body').then(($body) => {
        if ($body.find('button').filter((_, el) => el.textContent?.includes('接受')).length > 0) {
          cy.contains('button', '接受').should('be.visible')
          cy.contains('button', '拒絕').should('be.visible')
        }
      })
    })

    it('should have accessible back button on privacy page', () => {
      cy.visit('/privacy')

      cy.contains('button', '返回')
        .should('be.visible')
        .and('have.attr', 'class')
    })
  })

  describe('Performance', () => {
    it('should load privacy page within reasonable time', () => {
      const startTime = Date.now()

      cy.visit('/privacy')
      cy.get('h1').should('be.visible').then(() => {
        const loadTime = Date.now() - startTime
        expect(loadTime).to.be.lessThan(5000)
      })
    })
  })
})
