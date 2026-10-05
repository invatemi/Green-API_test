import { receiveNext } from './receiveNext'

/** Результат dispatch для одного шага опроса. */
interface ReceiveTask {
  /**
   * Прерывает текущий запрос опроса.
   */
  abort: () => void
  /**
   * Ждёт завершения шага и пробрасывает ошибку сети.
   * @returns Пустое завершение шага.
   */
  unwrap: () => Promise<unknown>
}

/**
 * Опрашивает очередь, пока сессия жива и сигнал не отменён.
 * Пустой ответ сразу запускает следующее ожидание. Ошибка сети ждёт секунду.
 * @param dispatch Dispatch, который принимает receiveNext.
 * @param signal Сигнал остановки при выходе или размонтировании.
 */
export async function runReceiveLoop(
  dispatch: (action: ReturnType<typeof receiveNext>) => ReceiveTask,
  signal: AbortSignal,
): Promise<void> {
  while (!signal.aborted) {
    const task = dispatch(receiveNext())
    const abortTask = () => {
      task.abort()
    }
    signal.addEventListener('abort', abortTask)

    try {
      await task.unwrap()
    } catch {
      signal.removeEventListener('abort', abortTask)
      if (signal.aborted) {
        return
      }
      await wait(1000, signal)
      continue
    }

    signal.removeEventListener('abort', abortTask)
  }
}

/**
 * Ждёт паузу или отмену.
 * @param ms Длительность паузы.
 * @param signal Сигнал остановки.
 */
function wait(ms: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve) => {
    const timer = setTimeout(() => resolve(), ms)
    signal.addEventListener(
      'abort',
      () => {
        clearTimeout(timer)
        resolve()
      },
      { once: true },
    )
  })
}
