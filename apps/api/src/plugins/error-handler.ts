import type { FastifyPluginAsync, FastifyError } from 'fastify'
import fp from 'fastify-plugin'
import { ZodError } from 'zod'
import type { AppConfig } from '../config'

export interface ErrorResponse {
  statusCode: number
  error: string
  message: string
  details?: unknown
}

export interface ErrorHandlerOptions {
  config: AppConfig
}

/**
 * Plugin de manejo global de errores y 404 con logging estructurado mediante Pino.
 */
const errorHandlerPluginFn: FastifyPluginAsync<ErrorHandlerOptions> = async (
  fastify,
  options,
) => {
  const isProduction = options.config.NODE_ENV === 'production'

  // ── Manejo global de 404 (Ruta no encontrada) ─────────────────────────────
  fastify.setNotFoundHandler((request, reply) => {
    request.log.info(
      { method: request.method, url: request.url },
      'Ruta no encontrada',
    )
    const response: ErrorResponse = {
      statusCode: 404,
      error: 'Not Found',
      message: `Ruta ${request.method} ${request.url} no encontrada`,
    }
    return reply.status(404).send(response)
  })

  // ── Manejo global de errores (5xx, 4xx, Zod, Fastify) ─────────────────────
  fastify.setErrorHandler((error: FastifyError | Error, request, reply) => {
    // 1. Error de validación con Zod
    if (error instanceof ZodError) {
      request.log.warn(
        { issues: error.issues, url: request.url },
        'Error de validación Zod',
      )
      const response: ErrorResponse = {
        statusCode: 400,
        error: 'Bad Request',
        message: 'Error de validación en los datos de la solicitud',
        details: error.flatten(),
      }
      return reply.status(400).send(response)
    }

    // 2. Error de validación nativo de Fastify
    const fastifyErr = error as FastifyError
    if (fastifyErr.validation) {
      request.log.warn(
        { validation: fastifyErr.validation, url: request.url },
        'Error de validación Fastify',
      )
      const response: ErrorResponse = {
        statusCode: 400,
        error: 'Bad Request',
        message: fastifyErr.message,
        details: fastifyErr.validation,
      }
      return reply.status(400).send(response)
    }

    // 3. Error con statusCode explícito (4xx)
    const statusCode = fastifyErr.statusCode ?? 500

    if (statusCode < 500) {
      request.log.warn(
        { statusCode, message: error.message, url: request.url },
        'Error de cliente en la solicitud',
      )
      const response: ErrorResponse = {
        statusCode,
        error: fastifyErr.name || 'Client Error',
        message: error.message,
      }
      return reply.status(statusCode).send(response)
    }

    // 4. Error 500 (Error de servidor no controlado)
    request.log.error(
      {
        err: error,
        reqId: request.id,
        method: request.method,
        url: request.url,
      },
      'Error interno no controlado del servidor',
    )

    const response: ErrorResponse = {
      statusCode: 500,
      error: 'Internal Server Error',
      message: isProduction
        ? 'Ha ocurrido un error inesperado en el servidor'
        : error.message || 'Ha ocurrido un error inesperado',
      details: !isProduction ? { stack: error.stack } : undefined,
    }

    return reply.status(500).send(response)
  })
}

export const errorHandlerPlugin = fp(errorHandlerPluginFn, {
  name: 'corchetes-error-handler',
  fastify: '5.x',
})
