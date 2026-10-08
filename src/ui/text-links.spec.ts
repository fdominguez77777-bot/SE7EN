import { calendarDescriptionHtml, descriptionToPlainText, firstHttpUrl, splitLinkedText } from './text-links'

describe('descriptionToPlainText', () => {
  it('keeps the href when the anchor label is not the url', () => {
    expect(
      descriptionToPlainText('<a href="https://tvpt.webex.com/meet/abc">Join meeting</a>'),
    ).toBe('Join meeting\nhttps://tvpt.webex.com/meet/abc')
  })

  it('does not duplicate a url that is already visible', () => {
    expect(
      descriptionToPlainText(
        '<a href="https://teams.microsoft.com/l/meetup-join/1">https://teams.microsoft.com/l/meetup-join/1</a>',
      ),
    ).toBe('https://teams.microsoft.com/l/meetup-join/1')
  })
})

describe('calendarDescriptionHtml', () => {
  it('keeps Google line breaks, emphasis, and links', () => {
    expect(
      calendarDescriptionHtml(
        '<div><b>Company</b>: Acme</div><div>Position: Engineer</div><div><a href="https://zoom.us/j/123">https://zoom.us/j/123</a></div>',
      ),
    ).toBe(
      '<p><b>Company</b>: Acme</p><p>Position: Engineer</p><p><a class="iv-meet-link" href="https://zoom.us/j/123" target="_blank" rel="noreferrer">https://zoom.us/j/123</a></p>',
    )
  })

  it('drops scripts and non-http links', () => {
    expect(calendarDescriptionHtml('<script>alert(1)</script><a href="javascript:alert(1)">x</a>')).toBe('x')
  })

  it('keeps plain text line breaks', () => {
    expect(calendarDescriptionHtml('Company: Acme\nPosition: Engineer')).toBe(
      'Company: Acme<br>Position: Engineer',
    )
  })

  it('highlights a bare meeting url and leaves other links plain', () => {
    expect(calendarDescriptionHtml('Join at https://meet.google.com/abc-defg-hij today')).toBe(
      'Join at <a class="iv-meet-link" href="https://meet.google.com/abc-defg-hij" target="_blank" rel="noreferrer">https://meet.google.com/abc-defg-hij</a> today',
    )
    expect(calendarDescriptionHtml('<a href="https://example.com/jobs">Role</a>')).toBe(
      '<a href="https://example.com/jobs" target="_blank" rel="noreferrer">Role</a>',
    )
  })
})

describe('splitLinkedText', () => {
  it('turns a bare meeting url into a selectable http link', () => {
    const parts = splitLinkedText(
      'Join from the meeting link\nhttps://tvpt.webex.com/tvpt/j.php?MTID=abc123',
    )
    expect(parts).toEqual([
      { text: 'Join from the meeting link\n' },
      {
        text: 'https://tvpt.webex.com/tvpt/j.php?MTID=abc123',
        href: 'https://tvpt.webex.com/tvpt/j.php?MTID=abc123',
      },
    ])
  })

  it('keeps trailing punctuation out of the href', () => {
    const parts = splitLinkedText('Join: https://zoom.us/j/123.')
    expect(parts).toEqual([
      { text: 'Join: ' },
      { text: 'https://zoom.us/j/123', href: 'https://zoom.us/j/123' },
      { text: '.' },
    ])
  })

  it('rejects javascript urls', () => {
    expect(splitLinkedText('javascript:alert(1)')).toEqual([{ text: 'javascript:alert(1)' }])
  })
})

describe('firstHttpUrl', () => {
  it('prefers a meeting join url over a help link', () => {
    expect(
      firstHttpUrl(
        'https://help.webex.com\nhttps://tvpt.webex.com/tvpt/j.php?MTID=abc',
      ),
    ).toBe('https://tvpt.webex.com/tvpt/j.php?MTID=abc')
  })
})
