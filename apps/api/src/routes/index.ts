import type { FastifyInstance } from 'fastify'
import { authRoutes } from './auth.js'
import { institutionRoutes } from './institutions.js'
import { dashboardRoutes } from './dashboard.js'
import { healthRoutes } from './health.js'
import { studentRoutes } from './students.js'
import { classRoutes } from './classes.js'
import { projectRoutes } from './projects.js'
import { activityRoutes } from './activities.js'
import { axisRoutes } from './axes.js'
import { planRoutes } from './plans.js'
import { diagnosticRoutes } from './diagnostics.js'
import { announcementRoutes } from './announcements.js'
import { libraryRoutes } from './library.js'
import { portalRoutes } from './portal.js'
import { requestRoutes } from './requests.js'
import { auditRoutes } from './audit.js'
import { reportRoutes } from './reports.js'

export async function registerRoutes(app: FastifyInstance): Promise<void> {
  await app.register(healthRoutes)
  await app.register(authRoutes)
  await app.register(institutionRoutes)
  await app.register(dashboardRoutes)
  await app.register(studentRoutes)
  await app.register(classRoutes)
  await app.register(projectRoutes)
  await app.register(activityRoutes)
  await app.register(axisRoutes)
  await app.register(planRoutes)
  await app.register(diagnosticRoutes)
  await app.register(announcementRoutes)
  await app.register(libraryRoutes)
  await app.register(portalRoutes)
  await app.register(requestRoutes)
  await app.register(auditRoutes)
  await app.register(reportRoutes)
}
