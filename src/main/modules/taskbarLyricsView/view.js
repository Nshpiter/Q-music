const line = window.createTimedLine(document.querySelector('p'))
window.taskbarLyrics.onLine((text, words, dark, vertical, progress, rate) => {
  document.body.classList.toggle('dark', dark)
  document.body.classList.toggle('vertical', vertical)
  line.setLine(text, words)
  line.sync(progress, rate, true)
})
window.taskbarLyrics.onClock((progress, rate) => { line.sync(progress, rate, true) })
