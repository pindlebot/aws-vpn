const Gauge = require('gauge')

let gauge

const createProgress = (label = 'create', n = 20) => {
  gauge = new Gauge()
  gauge.show(label, 0)
  let index = 0
  return {
    increment: (message) => {
      index++
      gauge.pulse(message)
      gauge.show(index, index / n)
    },
    reset: () => {}
  }
}

module.exports = {
  createProgress,
  gauge: () => gauge
}
