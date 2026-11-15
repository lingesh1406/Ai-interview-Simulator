import crypto from 'node:crypto';
import path from 'node:path';
import { DatabaseSync } from 'node:sqlite';
import { type Collection, type Db, MongoClient } from 'mongodb';

export interface UserRecord {
  id: string;
  full_name: string;
  email: string;
  password_hash: string;
  created_at: string;
}

export interface SessionRecord {
  id: string;
  user_id: string | null;
  role: string;
  experience_level: string;
  interview_type: string;
  total_questions: number;
  seconds_per_question: number;
  current_question_index: number;
  resume_text: string | null;
  job_description: string | null;
  demo_mode: boolean;
  status: string;
  created_at: string;
  completed_at: string | null;
}

export interface TurnRecord {
  id: string | number;
  session_id: string;
  sequence_number: number;
  question_number: number;
  is_followup: boolean;
  question_text: string;
  answer_text: string | null;
  duration_seconds: number | null;
  interviewer_transition: string | null;
  created_at: string;
}

export interface ReportRecord {
  session_id: string;
  overall_score: number;
  communication_score: number;
  technical_depth_score: number;
  confidence_score: number;
  relevance_score: number;
  verdict: string;
  summary: string;
  strengths: string[];
  weak_areas: string[];
  question_breakdown: Array<Record<string, unknown>>;
  created_at: string;
}

export interface HistoryItemRecord {
  session: SessionRecord;
  report: ReportRecord;
}

export interface DataStore {
  readonly engine: 'mongodb' | 'sqlite';
  readonly databaseName: string;
  findUserById(userId: string): Promise<UserRecord | null>;
  findUserByEmail(email: string): Promise<UserRecord | null>;
  createUser(user: UserRecord): Promise<UserRecord>;
  createSessionAndFirstTurn(
    session: Omit<SessionRecord, 'completed_at'>,
    firstQuestionText: string,
  ): Promise<{ session: SessionRecord; turn: TurnRecord }>;
  findSessionById(sessionId: string): Promise<SessionRecord | null>;
  listTurnsForSession(sessionId: string): Promise<TurnRecord[]>;
  updateTurnAnswer(turnId: string | number, answerText: string, durationSeconds: number): Promise<void>;
  updateTurnTransition(turnId: string | number, transition: string): Promise<void>;
  incrementSessionQuestionIndex(sessionId: string, nextQuestionIndex: number): Promise<SessionRecord | null>;
  createTurn(turn: Omit<TurnRecord, 'id'>): Promise<TurnRecord>;
  findReportBySessionId(sessionId: string): Promise<ReportRecord | null>;
  saveReportAndCompleteSession(
    report: ReportRecord,
  ): Promise<{ session: SessionRecord; report: ReportRecord }>;
  listCompletedHistoryForUser(userId: string): Promise<HistoryItemRecord[]>;
  close(): Promise<void>;
}

export function getConfiguredMongoUri(): string {
  const uri = (process.env.MONGODB_URI || '').trim();
  if (
    !uri ||
    uri === 'MY_MONGODB_URI' ||
    uri.includes('<username>') ||
    uri.includes('<password>') ||
    uri.includes('<cluster>')
  ) {
    return '';
  }
  return uri;
}

function resolveMongoDbName(uri: string): string {
  const explicit = (process.env.MONGODB_DB_NAME || '').trim();
  if (explicit) return explicit;
  try {
    const parsed = new URL(uri);
    const dbPath = parsed.pathname.replace(/^\/+/, '').trim();
    if (dbPath) return dbPath;
  } catch {
    // Ignore parse edge cases on custom URIs
  }
  return 'ai_interview_simulator';
}

class MongoDataStore implements DataStore {
  readonly engine = 'mongodb' as const;
  readonly databaseName: string;
  private client: MongoClient;
  private db: Db;
  private users: Collection<UserRecord>;
  private sessions: Collection<SessionRecord>;
  private turns: Collection<TurnRecord>;
  private reports: Collection<ReportRecord>;

  private constructor(client: MongoClient, db: Db, databaseName: string) {
    this.client = client;
    this.db = db;
    this.databaseName = databaseName;
    this.users = this.db.collection<UserRecord>('users');
    this.sessions = this.db.collection<SessionRecord>('interview_sessions');
    this.turns = this.db.collection<TurnRecord>('interview_turns');
    this.reports = this.db.collection<ReportRecord>('interview_reports');
  }

  static async connect(uri: string): Promise<MongoDataStore> {
    const dbName = resolveMongoDbName(uri);
    const client = new MongoClient(uri, {
      serverSelectionTimeoutMS: 8000,
    });
    await client.connect();
    const db = client.db(dbName);
    await db.command({ ping: 1 });

    const store = new MongoDataStore(client, db, dbName);
    await store.ensureIndexes();
    return store;
  }

  private async ensureIndexes(): Promise<void> {
    await Promise.all([
      this.users.createIndex({ id: 1 }, { unique: true }),
      this.users.createIndex({ email: 1 }, { unique: true }),
      this.sessions.createIndex({ id: 1 }, { unique: true }),
      this.sessions.createIndex({ user_id: 1, created_at: -1 }),
      this.turns.createIndex({ id: 1 }, { unique: true }),
      this.turns.createIndex({ session_id: 1, sequence_number: 1 }),
      this.reports.createIndex({ session_id: 1 }, { unique: true }),
    ]);
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    return this.users.findOne({ id: userId }, { projection: { _id: 0 } });
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    return this.users.findOne({ email }, { projection: { _id: 0 } });
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    await this.users.insertOne({ ...user });
    return { ...user };
  }

  async createSessionAndFirstTurn(
    session: Omit<SessionRecord, 'completed_at'>,
    firstQuestionText: string,
  ): Promise<{ session: SessionRecord; turn: TurnRecord }> {
    const fullSession: SessionRecord = {
      ...session,
      completed_at: null,
    };
    const firstTurn: TurnRecord = {
      id: crypto.randomUUID(),
      session_id: session.id,
      sequence_number: 1,
      question_number: 1,
      is_followup: false,
      question_text: firstQuestionText,
      answer_text: null,
      duration_seconds: null,
      interviewer_transition: null,
      created_at: session.created_at,
    };
    await this.sessions.insertOne({ ...fullSession });
    await this.turns.insertOne({ ...firstTurn });
    return { session: fullSession, turn: firstTurn };
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    return this.sessions.findOne({ id: sessionId }, { projection: { _id: 0 } });
  }

  async listTurnsForSession(sessionId: string): Promise<TurnRecord[]> {
    return this.turns
      .find({ session_id: sessionId }, { projection: { _id: 0 } })
      .sort({ sequence_number: 1 })
      .toArray();
  }

  async updateTurnAnswer(
    turnId: string | number,
    answerText: string,
    durationSeconds: number,
  ): Promise<void> {
    await this.turns.updateOne(
      { id: String(turnId) },
      { $set: { answer_text: answerText, duration_seconds: durationSeconds } },
    );
  }

  async updateTurnTransition(turnId: string | number, transition: string): Promise<void> {
    await this.turns.updateOne({ id: String(turnId) }, { $set: { interviewer_transition: transition } });
  }

  async incrementSessionQuestionIndex(
    sessionId: string,
    nextQuestionIndex: number,
  ): Promise<SessionRecord | null> {
    await this.sessions.updateOne(
      { id: sessionId },
      { $set: { current_question_index: nextQuestionIndex } },
    );
    return this.findSessionById(sessionId);
  }

  async createTurn(turn: Omit<TurnRecord, 'id'>): Promise<TurnRecord> {
    const doc: TurnRecord = {
      ...turn,
      id: crypto.randomUUID(),
    };
    await this.turns.insertOne({ ...doc });
    return doc;
  }

  async findReportBySessionId(sessionId: string): Promise<ReportRecord | null> {
    return this.reports.findOne({ session_id: sessionId }, { projection: { _id: 0 } });
  }

  async saveReportAndCompleteSession(
    report: ReportRecord,
  ): Promise<{ session: SessionRecord; report: ReportRecord }> {
    await this.reports.insertOne({ ...report });
    await this.sessions.updateOne(
      { id: report.session_id },
      { $set: { status: 'completed', completed_at: report.created_at } },
    );
    const session = (await this.findSessionById(report.session_id))!;
    return { session, report };
  }

  async listCompletedHistoryForUser(userId: string): Promise<HistoryItemRecord[]> {
    const sessions = await this.sessions
      .find({ user_id: userId, status: 'completed' }, { projection: { _id: 0 } })
      .sort({ created_at: -1 })
      .toArray();
    if (sessions.length === 0) return [];

    const sessionIds = sessions.map((s) => s.id);
    const reports = await this.reports
      .find({ session_id: { $in: sessionIds } }, { projection: { _id: 0 } })
      .toArray();
    const reportMap = new Map(reports.map((r) => [r.session_id, r]));

    const items: HistoryItemRecord[] = [];
    for (const session of sessions) {
      const report = reportMap.get(session.id);
      if (report) {
        items.push({ session, report });
      }
    }
    return items;
  }

  async close(): Promise<void> {
    await this.client.close();
  }
}

interface SqliteSessionRow {
  id: string;
  user_id: string | null;
  role: string;
  experience_level: string;
  interview_type: string;
  total_questions: number;
  seconds_per_question: number;
  current_question_index: number;
  resume_text: string | null;
  job_description: string | null;
  demo_mode: number;
  status: string;
  created_at: string;
  completed_at: string | null;
}

interface SqliteTurnRow {
  id: number;
  session_id: string;
  sequence_number: number;
  question_number: number;
  is_followup: number;
  question_text: string;
  answer_text: string | null;
  duration_seconds: number | null;
  interviewer_transition: string | null;
  created_at: string;
}

interface SqliteReportRow {
  id: number;
  session_id: string;
  overall_score: number;
  communication_score: number;
  technical_depth_score: number;
  confidence_score: number;
  relevance_score: number;
  verdict: string;
  summary: string;
  strengths_json: string;
  weak_areas_json: string;
  breakdown_json: string;
  created_at: string;
}

class SqliteDataStore implements DataStore {
  readonly engine = 'sqlite' as const;
  readonly databaseName = 'interview_simulator.db';
  private db: DatabaseSync;

  constructor() {
    const dbPath = path.resolve(process.cwd(), 'interview_simulator.db');
    this.db = new DatabaseSync(dbPath);
    this.db.exec('PRAGMA foreign_keys = ON;');
    this.db.exec(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        full_name TEXT NOT NULL,
        email TEXT NOT NULL UNIQUE,
        password_hash TEXT NOT NULL,
        created_at TEXT NOT NULL
      );

      CREATE TABLE IF NOT EXISTS interview_sessions (
        id TEXT PRIMARY KEY,
        user_id TEXT,
        role TEXT NOT NULL,
        experience_level TEXT NOT NULL,
        interview_type TEXT NOT NULL,
        total_questions INTEGER NOT NULL DEFAULT 5,
        seconds_per_question INTEGER NOT NULL DEFAULT 120,
        current_question_index INTEGER NOT NULL DEFAULT 1,
        resume_text TEXT,
        job_description TEXT,
        demo_mode INTEGER NOT NULL DEFAULT 0,
        status TEXT NOT NULL DEFAULT 'in_progress',
        created_at TEXT NOT NULL,
        completed_at TEXT,
        FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS interview_turns (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL,
        sequence_number INTEGER NOT NULL,
        question_number INTEGER NOT NULL,
        is_followup INTEGER NOT NULL DEFAULT 0,
        question_text TEXT NOT NULL,
        answer_text TEXT,
        duration_seconds INTEGER,
        interviewer_transition TEXT,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
      );

      CREATE TABLE IF NOT EXISTS interview_reports (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        session_id TEXT NOT NULL UNIQUE,
        overall_score INTEGER NOT NULL,
        communication_score INTEGER NOT NULL,
        technical_depth_score INTEGER NOT NULL,
        confidence_score INTEGER NOT NULL,
        relevance_score INTEGER NOT NULL,
        verdict TEXT NOT NULL,
        summary TEXT NOT NULL,
        strengths_json TEXT NOT NULL,
        weak_areas_json TEXT NOT NULL,
        breakdown_json TEXT NOT NULL,
        created_at TEXT NOT NULL,
        FOREIGN KEY (session_id) REFERENCES interview_sessions(id) ON DELETE CASCADE
      );
    `);

    const sessionCols = this.db
      .prepare('PRAGMA table_info(interview_sessions)')
      .all() as Array<{ name: string }>;
    if (!sessionCols.some((c) => c.name === 'user_id')) {
      this.db.exec('ALTER TABLE interview_sessions ADD COLUMN user_id TEXT;');
    }
  }

  private mapSession(row: SqliteSessionRow): SessionRecord {
    return {
      ...row,
      demo_mode: Boolean(row.demo_mode),
    };
  }

  private mapTurn(row: SqliteTurnRow): TurnRecord {
    return {
      ...row,
      is_followup: Boolean(row.is_followup),
    };
  }

  private mapReport(row: SqliteReportRow): ReportRecord {
    return {
      session_id: row.session_id,
      overall_score: row.overall_score,
      communication_score: row.communication_score,
      technical_depth_score: row.technical_depth_score,
      confidence_score: row.confidence_score,
      relevance_score: row.relevance_score,
      verdict: row.verdict,
      summary: row.summary,
      strengths: JSON.parse(row.strengths_json || '[]'),
      weak_areas: JSON.parse(row.weak_areas_json || '[]'),
      question_breakdown: JSON.parse(row.breakdown_json || '[]'),
      created_at: row.created_at,
    };
  }

  async findUserById(userId: string): Promise<UserRecord | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE id = ?').get(userId) as unknown as
      | UserRecord
      | undefined;
    return row ?? null;
  }

  async findUserByEmail(email: string): Promise<UserRecord | null> {
    const row = this.db.prepare('SELECT * FROM users WHERE email = ?').get(email) as unknown as
      | UserRecord
      | undefined;
    return row ?? null;
  }

  async createUser(user: UserRecord): Promise<UserRecord> {
    this.db
      .prepare(
        'INSERT INTO users (id, full_name, email, password_hash, created_at) VALUES (?, ?, ?, ?, ?)',
      )
      .run(user.id, user.full_name, user.email, user.password_hash, user.created_at);
    return { ...user };
  }

  async createSessionAndFirstTurn(
    session: Omit<SessionRecord, 'completed_at'>,
    firstQuestionText: string,
  ): Promise<{ session: SessionRecord; turn: TurnRecord }> {
    this.db
      .prepare(
        `INSERT INTO interview_sessions (
          id, user_id, role, experience_level, interview_type, total_questions,
          seconds_per_question, current_question_index, resume_text,
          job_description, demo_mode, status, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        session.id,
        session.user_id,
        session.role,
        session.experience_level,
        session.interview_type,
        session.total_questions,
        session.seconds_per_question,
        session.current_question_index,
        session.resume_text,
        session.job_description,
        session.demo_mode ? 1 : 0,
        session.status,
        session.created_at,
      );

    const inserted = this.db
      .prepare(
        `INSERT INTO interview_turns (
          session_id, sequence_number, question_number, is_followup, question_text, created_at
        ) VALUES (?, 1, 1, 0, ?, ?)`,
      )
      .run(session.id, firstQuestionText, session.created_at);

    const sessionRow = this.db
      .prepare('SELECT * FROM interview_sessions WHERE id = ?')
      .get(session.id) as unknown as SqliteSessionRow;
    const turnRow = this.db
      .prepare('SELECT * FROM interview_turns WHERE id = ?')
      .get(Number(inserted.lastInsertRowid)) as unknown as SqliteTurnRow;

    return {
      session: this.mapSession(sessionRow),
      turn: this.mapTurn(turnRow),
    };
  }

  async findSessionById(sessionId: string): Promise<SessionRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM interview_sessions WHERE id = ?')
      .get(sessionId) as unknown as SqliteSessionRow | undefined;
    return row ? this.mapSession(row) : null;
  }

  async listTurnsForSession(sessionId: string): Promise<TurnRecord[]> {
    const rows = this.db
      .prepare('SELECT * FROM interview_turns WHERE session_id = ? ORDER BY sequence_number ASC')
      .all(sessionId) as unknown as SqliteTurnRow[];
    return rows.map((row) => this.mapTurn(row));
  }

  async updateTurnAnswer(
    turnId: string | number,
    answerText: string,
    durationSeconds: number,
  ): Promise<void> {
    this.db
      .prepare('UPDATE interview_turns SET answer_text = ?, duration_seconds = ? WHERE id = ?')
      .run(answerText, durationSeconds, Number(turnId));
  }

  async updateTurnTransition(turnId: string | number, transition: string): Promise<void> {
    this.db
      .prepare('UPDATE interview_turns SET interviewer_transition = ? WHERE id = ?')
      .run(transition, Number(turnId));
  }

  async incrementSessionQuestionIndex(
    sessionId: string,
    nextQuestionIndex: number,
  ): Promise<SessionRecord | null> {
    this.db
      .prepare('UPDATE interview_sessions SET current_question_index = ? WHERE id = ?')
      .run(nextQuestionIndex, sessionId);
    return this.findSessionById(sessionId);
  }

  async createTurn(turn: Omit<TurnRecord, 'id'>): Promise<TurnRecord> {
    const inserted = this.db
      .prepare(
        `INSERT INTO interview_turns (
          session_id, sequence_number, question_number, is_followup, question_text, created_at
        ) VALUES (?, ?, ?, ?, ?, ?)`,
      )
      .run(
        turn.session_id,
        turn.sequence_number,
        turn.question_number,
        turn.is_followup ? 1 : 0,
        turn.question_text,
        turn.created_at,
      );
    const row = this.db
      .prepare('SELECT * FROM interview_turns WHERE id = ?')
      .get(Number(inserted.lastInsertRowid)) as unknown as SqliteTurnRow;
    return this.mapTurn(row);
  }

  async findReportBySessionId(sessionId: string): Promise<ReportRecord | null> {
    const row = this.db
      .prepare('SELECT * FROM interview_reports WHERE session_id = ?')
      .get(sessionId) as unknown as SqliteReportRow | undefined;
    return row ? this.mapReport(row) : null;
  }

  async saveReportAndCompleteSession(
    report: ReportRecord,
  ): Promise<{ session: SessionRecord; report: ReportRecord }> {
    this.db
      .prepare(
        `INSERT INTO interview_reports (
          session_id, overall_score, communication_score, technical_depth_score,
          confidence_score, relevance_score, verdict, summary,
          strengths_json, weak_areas_json, breakdown_json, created_at
        ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      )
      .run(
        report.session_id,
        report.overall_score,
        report.communication_score,
        report.technical_depth_score,
        report.confidence_score,
        report.relevance_score,
        report.verdict,
        report.summary,
        JSON.stringify(report.strengths),
        JSON.stringify(report.weak_areas),
        JSON.stringify(report.question_breakdown),
        report.created_at,
      );

    this.db
      .prepare("UPDATE interview_sessions SET status = 'completed', completed_at = ? WHERE id = ?")
      .run(report.created_at, report.session_id);

    const session = (await this.findSessionById(report.session_id))!;
    const saved = (await this.findReportBySessionId(report.session_id))!;
    return { session, report: saved };
  }

  async listCompletedHistoryForUser(userId: string): Promise<HistoryItemRecord[]> {
    const rows = this.db
      .prepare(
        `SELECT s.*, r.overall_score, r.communication_score, r.technical_depth_score,
                r.confidence_score, r.relevance_score, r.verdict, r.summary,
                r.strengths_json, r.weak_areas_json, r.breakdown_json, r.created_at AS report_created_at
         FROM interview_sessions s
         INNER JOIN interview_reports r ON r.session_id = s.id
         WHERE s.status = 'completed' AND s.user_id = ?
         ORDER BY s.created_at DESC`,
      )
      .all(userId) as unknown as Array<
      SqliteSessionRow & {
        overall_score: number;
        communication_score: number;
        technical_depth_score: number;
        confidence_score: number;
        relevance_score: number;
        verdict: string;
        summary: string;
        strengths_json: string;
        weak_areas_json: string;
        breakdown_json: string;
        report_created_at: string;
      }
    >;

    return rows.map((row) => ({
      session: this.mapSession(row),
      report: {
        session_id: row.id,
        overall_score: row.overall_score,
        communication_score: row.communication_score,
        technical_depth_score: row.technical_depth_score,
        confidence_score: row.confidence_score,
        relevance_score: row.relevance_score,
        verdict: row.verdict,
        summary: row.summary,
        strengths: JSON.parse(row.strengths_json || '[]'),
        weak_areas: JSON.parse(row.weak_areas_json || '[]'),
        question_breakdown: JSON.parse(row.breakdown_json || '[]'),
        created_at: row.report_created_at,
      },
    }));
  }

  async close(): Promise<void> {
    this.db.close();
  }
}

export async function createDataStore(): Promise<DataStore> {
  const mongoUri = getConfiguredMongoUri();
  if (mongoUri) {
    return MongoDataStore.connect(mongoUri);
  }
  return new SqliteDataStore();
}
