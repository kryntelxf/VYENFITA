/**
 * VYENFITA Application Analytics Service
 * 
 * Analytics for application usage
 * - User engagement
 * - Feature usage
 * - Performance metrics
 * - Error tracking
 * - User behavior
 * 
 * @version 1.0.0
 */

import { v4 as uuidv4 } from 'uuid';

export interface ApplicationAnalytics {
  id: string;
  applicationId: string;
  tenantId: string;
  date: Date;
  metrics: ApplicationMetrics;
  events: ApplicationEvent[];
  summary: ApplicationSummary;
}

export interface ApplicationMetrics {
  users: {
    total: number;
    active: number;
    new: number;
    returning: number;
  };
  sessions: {
    total: number;
    averageDuration: number;
    totalDuration: number;
  };
  usage: {
    pageViews: number;
    actions: number;
    workflows: number;
    apiCalls: number;
  };
  performance: {
    averageLoadTime: number;
    averageResponseTime: number;
    errorRate: number;
    uptime: number;
  };
}

export interface ApplicationEvent {
  id: string;
  type: 'page_view' | 'action' | 'workflow' | 'api_call' | 'error' | 'session';
  userId: string;
  sessionId: string;
  timestamp: Date;
  data: Record<string, any>;
  duration?: number;
  error?: string;
}

export interface ApplicationSummary {
  totalUsers: number;
  activeUsers: number;
  totalSessions: number;
  totalPageViews: number;
  totalActions: number;
  totalWorkflows: number;
  totalApiCalls: number;
  averageSessionDuration: number;
  errorRate: number;
  engagementScore: number;
}

export class ApplicationAnalyticsService {
  private analytics: Map<string, ApplicationAnalytics>;
  private events: Map<string, ApplicationEvent>;

  constructor() {
    this.analytics = new Map();
    this.events = new Map();
  }

  /**
   * Record an application event
   */
  recordEvent(
    applicationId: string,
    tenantId: string,
    userId: string,
    sessionId: string,
    type: ApplicationEvent['type'],
    data: Record<string, any>,
    duration?: number,
    error?: string
  ): ApplicationEvent {
    const event: ApplicationEvent = {
      id: uuidv4(),
      type,
      userId,
      sessionId,
      timestamp: new Date(),
      data,
      duration,
      error,
    };

    this.events.set(event.id, event);

    // Update analytics
    this.updateAnalytics(applicationId, tenantId, event);

    return event;
  }

  /**
   * Update analytics with new event
   */
  private updateAnalytics(applicationId: string, tenantId: string, event: ApplicationEvent): void {
    const date = new Date();
    date.setHours(0, 0, 0, 0);
    const key = `${applicationId}-${date.toISOString()}`;

    let analytics = this.analytics.get(key);
    if (!analytics) {
      analytics = {
        id: key,
        applicationId,
        tenantId,
        date,
        metrics: {
          users: { total: 0, active: 0, new: 0, returning: 0 },
          sessions: { total: 0, averageDuration: 0, totalDuration: 0 },
          usage: { pageViews: 0, actions: 0, workflows: 0, apiCalls: 0 },
          performance: { averageLoadTime: 0, averageResponseTime: 0, errorRate: 0, uptime: 100 },
        },
        events: [],
        summary: {
          totalUsers: 0,
          activeUsers: 0,
          totalSessions: 0,
          totalPageViews: 0,
          totalActions: 0,
          totalWorkflows: 0,
          totalApiCalls: 0,
          averageSessionDuration: 0,
          errorRate: 0,
          engagementScore: 0,
        },
      };
    }

    // Update metrics based on event type
    switch (event.type) {
      case 'session':
        analytics.metrics.sessions.total++;
        if (event.duration) {
          analytics.metrics.sessions.totalDuration += event.duration;
          analytics.metrics.sessions.averageDuration =
            analytics.metrics.sessions.totalDuration / analytics.metrics.sessions.total;
        }
        break;
      case 'page_view':
        analytics.metrics.usage.pageViews++;
        break;
      case 'action':
        analytics.metrics.usage.actions++;
        break;
      case 'workflow':
        analytics.metrics.usage.workflows++;
        break;
      case 'api_call':
        analytics.metrics.usage.apiCalls++;
        if (event.duration) {
          analytics.metrics.performance.averageResponseTime =
            (analytics.metrics.performance.averageResponseTime + event.duration) / 2;
        }
        break;
      case 'error':
        const errorRate = analytics.metrics.performance.errorRate;
        analytics.metrics.performance.errorRate = (errorRate + 1) / 2;
        break;
    }

    // Update users
    const userIds = new Set<string>();
    for (const e of analytics.events) {
      userIds.add(e.userId);
    }
    userIds.add(event.userId);
    analytics.metrics.users.total = userIds.size;

    // Update active users (events in last 24 hours)
    const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);
    const activeUsers = new Set<string>();
    for (const e of analytics.events) {
      if (e.timestamp >= dayAgo) {
        activeUsers.add(e.userId);
      }
    }
    analytics.metrics.users.active = activeUsers.size;

    // Update summary
    analytics.summary = this.calculateSummary(analytics);

    analytics.events.push(event);
    this.analytics.set(key, analytics);
  }

  /**
   * Calculate summary from analytics
   */
  private calculateSummary(analytics: ApplicationAnalytics): ApplicationSummary {
    const metrics = analytics.metrics;

    // Calculate engagement score (0-100)
    const engagementScore = Math.min(
      100,
      Math.max(0,
        (metrics.users.active / (metrics.users.total || 1)) * 40 +
        (metrics.sessions.total / (metrics.users.total || 1)) * 20 +
        (metrics.usage.pageViews / (metrics.users.total || 1)) * 20 +
        (metrics.usage.actions / (metrics.users.total || 1)) * 20
      )
    );

    return {
      totalUsers: metrics.users.total,
      activeUsers: metrics.users.active,
      totalSessions: metrics.sessions.total,
      totalPageViews: metrics.usage.pageViews,
      totalActions: metrics.usage.actions,
      totalWorkflows: metrics.usage.workflows,
      totalApiCalls: metrics.usage.apiCalls,
      averageSessionDuration: metrics.sessions.averageDuration,
      errorRate: metrics.performance.errorRate,
      engagementScore: Math.round(engagementScore),
    };
  }

  /**
   * Get analytics for an application
   */
  getAnalytics(applicationId: string, date?: Date): ApplicationAnalytics[] {
    const result: ApplicationAnalytics[] = [];

    for (const analytics of this.analytics.values()) {
      if (analytics.applicationId === applicationId) {
        if (date) {
          const d = new Date(date);
          d.setHours(0, 0, 0, 0);
          if (analytics.date.getTime() === d.getTime()) {
            result.push(analytics);
          }
        } else {
          result.push(analytics);
        }
      }
    }

    return result.sort((a, b) => a.date.getTime() - b.date.getTime());
  }

  /**
   * Get analytics summary for a tenant
   */
  getTenantAnalytics(tenantId: string): {
    totalApplications: number;
    totalUsers: number;
    totalEvents: number;
    averageEngagement: number;
    byApplication: {
      applicationId: string;
      name: string;
      users: number;
      events: number;
      engagementScore: number;
    }[];
  } {
    const appMap = new Map<string, {
      applicationId: string;
      name: string;
      users: Set<string>;
      events: number;
      totalEngagement: number;
      count: number;
    }>();

    for (const analytics of this.analytics.values()) {
      if (analytics.tenantId !== tenantId) continue;

      if (!appMap.has(analytics.applicationId)) {
        appMap.set(analytics.applicationId, {
          applicationId: analytics.applicationId,
          name: `App ${analytics.applicationId.substring(0, 8)}`,
          users: new Set<string>(),
          events: 0,
          totalEngagement: 0,
          count: 0,
        });
      }

      const app = appMap.get(analytics.applicationId)!;
      app.users.add(analytics.metrics.users.total);
      app.events += analytics.events.length;
      app.totalEngagement += analytics.summary.engagementScore;
      app.count++;
    }

    const byApplication = Array.from(appMap.values()).map(app => ({
      applicationId: app.applicationId,
      name: app.name,
      users: app.users.size,
      events: app.events,
      engagementScore: Math.round(app.totalEngagement / (app.count || 1)),
    }));

    const totalUsers = new Set<string>();
    let totalEvents = 0;
    let totalEngagement = 0;

    for (const app of appMap.values()) {
      for (const user of app.users) {
        totalUsers.add(user);
      }
      totalEvents += app.events;
      totalEngagement += app.totalEngagement;
    }

    return {
      totalApplications: appMap.size,
      totalUsers: totalUsers.size,
      totalEvents,
      averageEngagement: Math.round(totalEngagement / (appMap.size || 1)),
      byApplication,
    };
  }

  /**
   * Get events for an application
   */
  getEvents(
    applicationId: string,
    filter?: {
      type?: ApplicationEvent['type'];
      userId?: string;
      startDate?: Date;
      endDate?: Date;
      limit?: number;
    }
  ): ApplicationEvent[] {
    let result: ApplicationEvent[] = [];

    for (const event of this.events.values()) {
      const analytics = this.getAnalytics(applicationId);
      const hasAnalytics = analytics.some(a => a.events.includes(event));
      if (hasAnalytics) {
        result.push(event);
      }
    }

    // Apply filters
    if (filter?.type) {
      result = result.filter(e => e.type === filter.type);
    }
    if (filter?.userId) {
      result = result.filter(e => e.userId === filter.userId);
    }
    if (filter?.startDate) {
      result = result.filter(e => e.timestamp >= filter.startDate!);
    }
    if (filter?.endDate) {
      result = result.filter(e => e.timestamp <= filter.endDate!);
    }

    // Sort by timestamp (newest first)
    result = result.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    if (filter?.limit) {
      result = result.slice(0, filter.limit);
    }

    return result;
  }

  /**
   * Get user journey for an application
   */
  getUserJourney(applicationId: string, userId: string, limit: number = 50): {
    sessionId: string;
    events: ApplicationEvent[];
    startTime: Date;
    endTime: Date;
    duration: number;
  }[] {
    const events = this.getEvents(applicationId, { userId });
    const sessionMap = new Map<string, ApplicationEvent[]>();

    for (const event of events) {
      if (!sessionMap.has(event.sessionId)) {
        sessionMap.set(event.sessionId, []);
      }
      sessionMap.get(event.sessionId)!.push(event);
    }

    const journeys: {
      sessionId: string;
      events: ApplicationEvent[];
      startTime: Date;
      endTime: Date;
      duration: number;
    }[] = [];

    for (const [sessionId, sessionEvents] of sessionMap) {
      const sorted = sessionEvents.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());
      const startTime = sorted[0]?.timestamp || new Date();
      const endTime = sorted[sorted.length - 1]?.timestamp || new Date();

      journeys.push({
        sessionId,
        events: sorted,
        startTime,
        endTime,
        duration: endTime.getTime() - startTime.getTime(),
      });
    }

    return journeys
      .sort((a, b) => b.startTime.getTime() - a.startTime.getTime())
      .slice(0, limit);
  }
}
