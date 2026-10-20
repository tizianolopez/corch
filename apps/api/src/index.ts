/**
 * @corchetes/api — Servidor Fastify 5 de Corchetes
 */
import { buildApp } from './app'
import { config } from './config'

export * from './app'
export * from './config'

export const API_VERSION = '0.0.1'

/**
 * Arranca el servidor HTTP en el puerto y host configurados.
 */
async function start(): Promise<void> {
  const app = await buildApp()

  const shutdown = async (signal: string) => {
    app.log.info({ signal }, 'Cerrando servidor HTTP con gracia…')
    try {
      await app.close()
      app.log.info('Servidor HTTP cerrado correctamente')
      process.exit(0)
    } catch (err) {
      app.log.error({ err }, 'Error durante el cierre del servidor')
      process.exit(1)
    }
  }

  process.on('SIGINT', () => void shutdown('SIGINT'))
  process.on('SIGTERM', () => void shutdown('SIGTERM'))

  try {
    const address = await app.listen({
      port: config.PORT,
      host: config.HOST,
    })
    app.log.info(
      `🚀 Servidor @corchetes/api v${API_VERSION} escuchando en ${address} [${config.NODE_ENV}]`,
    )
  } catch (err) {
    app.log.fatal({ err }, 'Error crítico al iniciar el servidor')
    process.exit(1)
  }
}

// Iniciar automáticamente cuando se ejecuta directamente (no en tests)
if (process.env.NODE_ENV !== 'test') {
  void start()
}
