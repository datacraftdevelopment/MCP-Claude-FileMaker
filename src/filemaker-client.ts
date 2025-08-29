import axios, { AxiosInstance } from 'axios';
import NodeCache from 'node-cache';
import https from 'https';

interface FileMakerConfig {
  server: string;
  database: string;
  username: string;
  password: string;
  protocol: string;
  apiVersion: string;
}

interface SessionInfo {
  token: string;
  lastActivity: number;
}

export class FileMakerClient {
  private config: FileMakerConfig;
  private axios: AxiosInstance;
  private cache: NodeCache;
  private sessionCache: NodeCache;
  private sessionInfo: SessionInfo | null = null;

  constructor(config: FileMakerConfig) {
    this.config = config;
    
    // Cache for data (14 minutes to stay under session timeout)
    this.cache = new NodeCache({ 
      stdTTL: parseInt(process.env.CACHE_TTL || '840'),
      checkperiod: 120 
    });
    
    // Separate cache for sessions (13 minutes)
    this.sessionCache = new NodeCache({ 
      stdTTL: 780,
      checkperiod: 60 
    });

    // Create axios instance with self-signed cert handling
    this.axios = axios.create({
      baseURL: `${config.protocol}://${config.server}/fmi/data/${config.apiVersion}/databases/${config.database}`,
      headers: {
        'Content-Type': 'application/json',
      },
      httpsAgent: new https.Agent({
        rejectUnauthorized: false // For self-signed certificates
      })
    });
  }

  private async authenticate(): Promise<string> {
    const cacheKey = `session_${this.config.database}`;
    const cachedSession = this.sessionCache.get<SessionInfo>(cacheKey);
    
    if (cachedSession) {
      this.sessionInfo = cachedSession;
      return cachedSession.token;
    }

    try {
      const response = await this.axios.post('/sessions', {}, {
        auth: {
          username: this.config.username,
          password: this.config.password
        }
      });

      const token = response.data.response.token;
      this.sessionInfo = {
        token,
        lastActivity: Date.now()
      };
      
      this.sessionCache.set(cacheKey, this.sessionInfo);
      
      return token;
    } catch (error: any) {
      throw new Error(`Authentication failed: ${error.response?.data?.messages?.[0]?.message || error.message}`);
    }
  }

  private async request(method: string, endpoint: string, data?: any): Promise<any> {
    const token = await this.authenticate();
    
    try {
      const response = await this.axios({
        method,
        url: endpoint,
        data,
        headers: {
          'Authorization': `Bearer ${token}`
        }
      });
      
      return response.data;
    } catch (error: any) {
      // If unauthorized, clear session and retry once
      if (error.response?.status === 401) {
        this.sessionCache.del(`session_${this.config.database}`);
        const newToken = await this.authenticate();
        
        const retryResponse = await this.axios({
          method,
          url: endpoint,
          data,
          headers: {
            'Authorization': `Bearer ${newToken}`
          }
        });
        
        return retryResponse.data;
      }
      
      throw new Error(`Request failed: ${error.response?.data?.messages?.[0]?.message || error.message}`);
    }
  }

  async getLayouts(): Promise<any> {
    const cacheKey = `layouts_${this.config.database}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.request('GET', '/layouts');
    this.cache.set(cacheKey, result);
    return result;
  }

  async getLayout(layoutName: string): Promise<any> {
    const cacheKey = `layout_${this.config.database}_${layoutName}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.request('GET', `/layouts/${encodeURIComponent(layoutName)}`);
    this.cache.set(cacheKey, result);
    return result;
  }

  async findRecords(layoutName: string, query: any): Promise<any> {
    const cacheKey = `find_${this.config.database}_${layoutName}_${JSON.stringify(query)}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.request('POST', `/layouts/${encodeURIComponent(layoutName)}/_find`, query);
    this.cache.set(cacheKey, result);
    return result;
  }

  async getRecords(layoutName: string, limit: number = 100, offset: number = 1): Promise<any> {
    const cacheKey = `records_${this.config.database}_${layoutName}_${limit}_${offset}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.request('GET', `/layouts/${encodeURIComponent(layoutName)}/records?_limit=${limit}&_offset=${offset}`);
    this.cache.set(cacheKey, result);
    return result;
  }

  async getRecord(layoutName: string, recordId: string): Promise<any> {
    const cacheKey = `record_${this.config.database}_${layoutName}_${recordId}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.request('GET', `/layouts/${encodeURIComponent(layoutName)}/records/${recordId}`);
    this.cache.set(cacheKey, result);
    return result;
  }

  async runScript(layoutName: string, scriptName: string, parameter?: string): Promise<any> {
    // Scripts are not cached as they may have side effects
    const data: any = {
      'script': scriptName
    };
    
    if (parameter) {
      data['script.param'] = parameter;
    }

    return await this.request('GET', `/layouts/${encodeURIComponent(layoutName)}/script/${encodeURIComponent(scriptName)}`, data);
  }

  async getProductInfo(): Promise<any> {
    const cacheKey = `productInfo_${this.config.database}`;
    const cached = this.cache.get(cacheKey);
    
    if (cached) {
      return cached;
    }

    const result = await this.request('GET', '/productInfo');
    this.cache.set(cacheKey, result);
    return result;
  }

  clearCache(): void {
    this.cache.flushAll();
  }

  clearSessionCache(): void {
    this.sessionCache.flushAll();
    this.sessionInfo = null;
  }
}