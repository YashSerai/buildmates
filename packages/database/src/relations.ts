import { relations } from "drizzle-orm";
import {
  circleMemberships, circles, cohortInvitations, cohortMemberships, cohorts, connectionCards, connectionPrivateNotes, connectionSides,
  connections, handles, messages, profiles, projectCollaborators, projects, roomMemberships, rooms,
  surfaceRevisions, surfaces, users, workSignals,
} from "./schema";

export const usersRelations = relations(users, ({ one, many }) => ({
  handle: one(handles, { fields: [users.id], references: [handles.userId] }),
  profile: one(profiles, { fields: [users.id], references: [profiles.userId] }),
  projects: many(projects), workSignals: many(workSignals), projectCollaborations: many(projectCollaborators),
  roomMemberships: many(roomMemberships), circleMemberships: many(circleMemberships),
  cohortMemberships: many(cohortMemberships), connectionSides: many(connectionSides), privateConnectionNotes: many(connectionPrivateNotes),
}));
export const profilesRelations = relations(profiles, ({ one }) => ({ user: one(users, { fields: [profiles.userId], references: [users.id] }) }));
export const handlesRelations = relations(handles, ({ one }) => ({ user: one(users, { fields: [handles.userId], references: [users.id] }) }));
export const projectsRelations = relations(projects, ({ one, many }) => ({ owner: one(users, { fields: [projects.ownerUserId], references: [users.id] }), collaborators: many(projectCollaborators) }));
export const projectCollaboratorsRelations = relations(projectCollaborators, ({ one }) => ({ project: one(projects, { fields: [projectCollaborators.projectId], references: [projects.id] }), user: one(users, { fields: [projectCollaborators.userId], references: [users.id] }) }));
export const cohortsRelations = relations(cohorts, ({ many }) => ({ memberships: many(cohortMemberships), invitations: many(cohortInvitations) }));
export const cohortMembershipsRelations = relations(cohortMemberships, ({ one }) => ({ cohort: one(cohorts, { fields: [cohortMemberships.cohortId], references: [cohorts.id] }), user: one(users, { fields: [cohortMemberships.userId], references: [users.id] }) }));
export const cohortInvitationsRelations = relations(cohortInvitations, ({ one }) => ({ cohort: one(cohorts, { fields: [cohortInvitations.cohortId], references: [cohorts.id] }), inviter: one(users, { fields: [cohortInvitations.inviterUserId], references: [users.id] }) }));
export const connectionCardsRelations = relations(connectionCards, ({ one }) => ({ creator: one(users, { fields: [connectionCards.creatorUserId], references: [users.id] }), project: one(projects, { fields: [connectionCards.projectId], references: [projects.id] }) }));
export const connectionsRelations = relations(connections, ({ many, one }) => ({ sides: many(connectionSides), privateNotes: many(connectionPrivateNotes), room: one(rooms, { fields: [connections.id], references: [rooms.connectionId] }) }));
export const roomsRelations = relations(rooms, ({ one, many }) => ({ connection: one(connections, { fields: [rooms.connectionId], references: [connections.id] }), members: many(roomMemberships), messages: many(messages) }));
export const roomMembershipsRelations = relations(roomMemberships, ({ one }) => ({ room: one(rooms, { fields: [roomMemberships.roomId], references: [rooms.id] }), user: one(users, { fields: [roomMemberships.userId], references: [users.id] }) }));
export const messagesRelations = relations(messages, ({ one }) => ({ room: one(rooms, { fields: [messages.roomId], references: [rooms.id] }), sender: one(users, { fields: [messages.senderUserId], references: [users.id] }) }));
export const circlesRelations = relations(circles, ({ many }) => ({ memberships: many(circleMemberships) }));
export const circleMembershipsRelations = relations(circleMemberships, ({ one }) => ({ circle: one(circles, { fields: [circleMemberships.circleId], references: [circles.id] }), user: one(users, { fields: [circleMemberships.userId], references: [users.id] }) }));
export const surfacesRelations = relations(surfaces, ({ many }) => ({ revisions: many(surfaceRevisions) }));
export const surfaceRevisionsRelations = relations(surfaceRevisions, ({ one }) => ({ surface: one(surfaces, { fields: [surfaceRevisions.surfaceId], references: [surfaces.id] }) }));
