import { afterEach, describe, expect, it, vi } from 'vitest'

import { runReceiveLoop } from './receiveLoop'

afterEach(() => {
  vi.useRealTimers()
})

describe('runReceiveLoop', () => {
  it('не опрашивает очередь, если сигнал уже отменён', async () => {
    const dispatch = vi.fn()
    const controller = new AbortController()
    controller.abort()

    await runReceiveLoop(dispatch, controller.signal)

    expect(dispatch).not.toHaveBeenCalled()
  })

  it('пустой ответ сразу запускает следующий шаг', async () => {
    const controller = new AbortController()
    let calls = 0

    await runReceiveLoop(() => {
      calls += 1
      return {
        abort() {
          return undefined
        },
        unwrap: async () => {
          if (calls >= 2) {
            controller.abort()
          }
        },
      }
    }, controller.signal)

    expect(calls).toBe(2)
  })

  it('после ошибки сети ждёт секунду и повторяет шаг', async () => {
    vi.useFakeTimers()
    const controller = new AbortController()
    const calls: number[] = []

    const loop = runReceiveLoop(() => {
      const attempt = calls.length + 1
      calls.push(attempt)
      return {
        abort() {
          controller.abort()
        },
        unwrap() {
          if (attempt === 1) {
            return Promise.reject(new Error('network'))
          }
          controller.abort()
          return Promise.resolve()
        },
      }
    }, controller.signal)

    await vi.advanceTimersByTimeAsync(1000)
    await loop

    expect(calls).toEqual([1, 2])
  })

  it('отмена во время шага завершает цикл', async () => {
    const controller = new AbortController()
    let rejectUnwrap: (error: unknown) => void = () => {}

    const loop = runReceiveLoop(() => {
      return {
        abort() {
          rejectUnwrap(new DOMException('Aborted', 'AbortError'))
        },
        unwrap: () =>
          new Promise((_resolve, reject) => {
            rejectUnwrap = reject
          }),
      }
    }, controller.signal)

    controller.abort()
    await loop
  })
})
