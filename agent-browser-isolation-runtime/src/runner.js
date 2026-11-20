'use strict';

const { BrowserProfile } = require('./browser');

/**
 * JobRunner launches independent jobs, each bound to its own isolated profile.
 * A job can be killed mid-run without touching the other jobs or their profile
 * state. Each profile persists cookies/storage to its own state file, so a
 * killed job can be recovered on restart by re-opening the same profile.
 */
class JobRunner {
  constructor({ store, baseUrl, driver = 'fixture' }) {
    this.store = store;
    this.baseUrl = baseUrl;
    this.driver = driver;
    this.jobs = new Map();
  }

  createJob({ id, profile, account, password }) {
    if (this.jobs.has(id)) throw new Error(`job ${id} already exists`);
    const job = {
      id,
      profile,
      account,
      password,
      status: 'created',
      aborted: false,
      result: null,
      error: null,
      _abort: null,
      _profile: null,
    };
    this.jobs.set(id, job);
    return job;
  }

  _abortSignal(job) {
    return new Promise((_, reject) => {
      job._abort = (reason) => reject(new Error(reason || `job ${job.id} aborted`));
    });
  }

  async runJob(job) {
    if (job.status === 'killed') throw new Error(`job ${job.id} is killed`);
    job.status = 'running';
    const abort = this._abortSignal(job);
    const profile = new BrowserProfile({ store: this.store, name: job.profile, driver: this.driver });
    job._profile = profile;
    try {
      await Promise.race([
        (async () => {
          await profile.navigate(`${this.baseUrl}/`);
          if (job.aborted) throw new Error('aborted before login');
          await profile.type('#username', job.account);
          await profile.type('#password', job.password);
          if (job.aborted) throw new Error('aborted before click');
          await profile.click('#login', `${this.baseUrl}/login`);
          if (job.aborted) throw new Error('aborted before extract');
          const data = await profile.extract('#account-data');
          if (!data.account) throw new Error(`login failed for ${job.account}`);
          job.result = { account: data.account, items: data.items, profile: job.profile };
          job.status = 'done';
          return job.result;
        })(),
        abort,
      ]);
      return job.result;
    } catch (err) {
      if (job.aborted || job.status === 'killed') {
        job.status = 'killed';
        job.error = err.message;
      } else {
        job.status = 'failed';
        job.error = err.message;
      }
      throw err;
    } finally {
      profile.close();
    }
  }

  killJob(id) {
    const job = this.jobs.get(id);
    if (!job) return false;
    job.aborted = true;
    job.status = 'killed';
    if (job._abort) job._abort(`job ${id} killed`);
    if (job._profile) {
      // State was persisted before abort; closing flushes it again.
      try { job._profile.close(); } catch { /* already closed */ }
    }
    return true;
  }

  recoverJob(id) {
    const job = this.jobs.get(id);
    if (!job) throw new Error(`unknown job ${id}`);
    if (!this.store.exists(job.profile)) {
      throw new Error(`profile state for job ${id} is missing`);
    }
    job.aborted = false;
    job.status = 'created';
    job.error = null;
    return job;
  }

  async runConcurrent(jobs) {
    return Promise.allSettled(jobs.map((j) => this.runJob(j)));
  }
}

module.exports = { JobRunner };