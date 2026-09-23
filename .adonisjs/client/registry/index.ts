/* eslint-disable prettier/prettier */
import type { AdonisEndpoint } from '@tuyau/core/types'
import type { Registry } from './schema.d.ts'
import type { ApiDefinition } from './tree.d.ts'

const placeholder: any = {}

const routes = {
  'home': {
    methods: ["GET","HEAD"],
    pattern: '/',
    tokens: [{"old":"/","type":0,"val":"/","end":""}],
    types: placeholder as Registry['home']['types'],
  },
  'new_account.create': {
    methods: ["GET","HEAD"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.create']['types'],
  },
  'new_account.store': {
    methods: ["POST"],
    pattern: '/signup',
    tokens: [{"old":"/signup","type":0,"val":"signup","end":""}],
    types: placeholder as Registry['new_account.store']['types'],
  },
  'session.create': {
    methods: ["GET","HEAD"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.create']['types'],
  },
  'session.store': {
    methods: ["POST"],
    pattern: '/login',
    tokens: [{"old":"/login","type":0,"val":"login","end":""}],
    types: placeholder as Registry['session.store']['types'],
  },
  'session.destroy': {
    methods: ["POST"],
    pattern: '/logout',
    tokens: [{"old":"/logout","type":0,"val":"logout","end":""}],
    types: placeholder as Registry['session.destroy']['types'],
  },
  'documents.index': {
    methods: ["GET","HEAD"],
    pattern: '/documents',
    tokens: [{"old":"/documents","type":0,"val":"documents","end":""}],
    types: placeholder as Registry['documents.index']['types'],
  },
  'documents.create': {
    methods: ["GET","HEAD"],
    pattern: '/documents/create',
    tokens: [{"old":"/documents/create","type":0,"val":"documents","end":""},{"old":"/documents/create","type":0,"val":"create","end":""}],
    types: placeholder as Registry['documents.create']['types'],
  },
  'documents.store': {
    methods: ["POST"],
    pattern: '/documents',
    tokens: [{"old":"/documents","type":0,"val":"documents","end":""}],
    types: placeholder as Registry['documents.store']['types'],
  },
  'documents.edit': {
    methods: ["GET","HEAD"],
    pattern: '/documents/:id/edit',
    tokens: [{"old":"/documents/:id/edit","type":0,"val":"documents","end":""},{"old":"/documents/:id/edit","type":1,"val":"id","end":""},{"old":"/documents/:id/edit","type":0,"val":"edit","end":""}],
    types: placeholder as Registry['documents.edit']['types'],
  },
  'documents.update': {
    methods: ["PUT","PATCH"],
    pattern: '/documents/:id',
    tokens: [{"old":"/documents/:id","type":0,"val":"documents","end":""},{"old":"/documents/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['documents.update']['types'],
  },
  'documents.destroy': {
    methods: ["DELETE"],
    pattern: '/documents/:id',
    tokens: [{"old":"/documents/:id","type":0,"val":"documents","end":""},{"old":"/documents/:id","type":1,"val":"id","end":""}],
    types: placeholder as Registry['documents.destroy']['types'],
  },
} as const satisfies Record<string, AdonisEndpoint>

export { routes }

export const registry = {
  routes,
  $tree: {} as ApiDefinition,
}

declare module '@tuyau/core/types' {
  export interface UserRegistry {
    routes: typeof routes
    $tree: ApiDefinition
  }
}
