import { descriptionToPlainText, firstHttpUrl, splitLinkedText } from './text-links'

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
