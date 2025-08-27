import React, { useState, useEffect } from 'react';
import { 
  Shield, AlertTriangle, Activity, Users, Clock, Download, 
  Filter, Search, Bell, CheckCircle, XCircle, Eye, TrendingUp,
  BarChart3, PieChart, Calendar, RefreshCw
} from 'lucide-react';
import ReactECharts from 'echarts-for-react';
import { auditDashboard } from '../lib/audit/auditDashboard';
import { auditAlerts } from '../lib/audit/auditAlerts';
import { useAuth } from '../contexts/AuthContext';
import { AuditFilter, AuditMetrics, AuditAlert } from '../lib/audit/types';

const AuditoriaDashboard: React.FC = () => {
  const { user } = useAuth();
  const [loading, setLoading] = useState(true);
  const [metrics, setMetrics] = useState<AuditMetrics | null>(null);
  const [alerts, setAlerts] = useState<AuditAlert[]>([]);
  const [logs, setLogs] = useState<any[]>([]);
  const [userStats, setUserStats] = useState<any[]>([]);
  const [trends, setTrends] = useState<any[]>([]);
  const [activeTab, setActiveTab] = useState<'overview' | 'logs' | 'alerts' | 'users'>('overview');
  const [filter, setFilter] = useState<AuditFilter>({
    start_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(),
    end_date: new Date().toISOString(),
    limit: 50
  });
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedSeverity, setSelectedSeverity] = useState<string>('');
  const [selectedAction, setSelectedAction] = useState<string>('');

  useEffect(() => {
    if (user?.id) {
      loadDashboardData();
      setupRealtimeAlerts();
    }

    return () => {
      auditAlerts.stopRealtimeMonitoring();
    };
  }, [user?.id]);

  useEffect(() => {
    if (user?.id) {
      loadLogs();
    }
  }, [filter, searchTerm, selectedSeverity, selectedAction]);

  const loadDashboardData = async () => {
    if (!user?.id) return;

    setLoading(true);
    try {
      const startDate = new Date(filter.start_date!);
      const endDate = new Date(filter.end_date!);

      // Carregar métricas
      const metricsData = await auditDashboard.generateRealtimeMetrics(user.id, 24);
      setMetrics(metricsData);

      // Carregar alertas
      const alertsData = await auditDashboard.getAuditAlerts(user.id, undefined, 20);
      setAlerts(alertsData);

      // Carregar estatísticas de usuários
      const userStatsData = await auditDashboard.getUserActivityStats(user.id, startDate, endDate);
      setUserStats(userStatsData);

      // Carregar tendências
      const trendsData = await auditDashboard.getActivityTrends(user.id, startDate, endDate, 'day');
      setTrends(trendsData);
    } catch (error) {
      console.error('Erro ao carregar dados do dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const loadLogs = async () => {
    if (!user?.id) return;

    try {
      const currentFilter = {
        ...filter,
        search: searchTerm || undefined,
        severity: selectedSeverity || undefined,
        action: selectedAction || undefined
      };

      const logsData = await auditDashboard.getAuditLogs(currentFilter);
      setLogs(logsData);
    } catch (error) {
      console.error('Erro ao carregar logs:', error);
    }
  };

  const setupRealtimeAlerts = () => {
    if (!user?.id) return;

    auditAlerts.startRealtimeMonitoring(user.id);
    auditAlerts.onAlert('dashboard', (alert) => {
      setAlerts(prev => [alert, ...prev.slice(0, 19)]);
      
      // Mostrar notificação
      if (Notification.permission === 'granted') {
        new Notification(`Alerta de Auditoria: ${alert.title}`, {
          body: alert.message,
          icon: '/favicon.ico'
        });
      }
    });
  };

  const handleExportLogs = async () => {
    if (!user?.id) return;

    try {
      const csvData = await auditDashboard.exportAuditLogs(user.id, filter, 'csv');
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `audit-logs-${new Date().toISOString().split('T')[0]}.csv`;
      a.click();
      URL.revokeObjectURL(url);
    } catch (error) {
      console.error('Erro ao exportar logs:', error);
    }
  };

  const handleAlertAction = async (alertId: string, action: string) => {
    try {
      await auditDashboard.updateAlertStatus(alertId, action, user?.id);
      setAlerts(prev => prev.map(alert => 
        alert.id === alertId ? { ...alert, status: action } : alert
      ));
    } catch (error) {
      console.error('Erro ao atualizar alerta:', error);
    }
  };

  const getMetricsChartOptions = () => {
    if (!metrics) return {};

    return {
      title: { text: 'Distribuição de Eventos por Severidade' },
      tooltip: { trigger: 'item' },
      series: [{
        type: 'pie',
        radius: '50%',
        data: [
          { value: metrics.low_severity, name: 'Baixa' },
          { value: metrics.medium_severity, name: 'Média' },
          { value: metrics.high_severity, name: 'Alta' },
          { value: metrics.critical_severity, name: 'Crítica' }
        ],
        emphasis: {
          itemStyle: {
            shadowBlur: 10,
            shadowOffsetX: 0,
            shadowColor: 'rgba(0, 0, 0, 0.5)'
          }
        }
      }]
    };
  };

  const getTrendsChartOptions = () => {
    return {
      title: { text: 'Tendência de Atividade' },
      tooltip: { trigger: 'axis' },
      xAxis: {
        type: 'category',
        data: trends.map(t => t.period)
      },
      yAxis: { type: 'value' },
      series: [{
        data: trends.map(t => t.total_events),
        type: 'line',
        smooth: true,
        areaStyle: {}
      }]
    };
  };

  const getSeverityColor = (severity: string) => {
    switch (severity) {
      case 'CRITICAL': return 'text-red-600 bg-red-100';
      case 'HIGH': return 'text-orange-600 bg-orange-100';
      case 'MEDIUM': return 'text-yellow-600 bg-yellow-100';
      case 'LOW': return 'text-green-600 bg-green-100';
      default: return 'text-gray-600 bg-gray-100';
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'SUCCESS': return 'text-green-600';
      case 'ERROR': case 'FAILURE': return 'text-red-600';
      case 'WARNING': return 'text-yellow-600';
      default: return 'text-gray-600';
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <RefreshCw className="w-8 h-8 animate-spin text-blue-600" />
        <span className="ml-2 text-gray-600">Carregando dashboard...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h2 className="text-3xl font-bold text-gray-900 flex items-center">
            <Shield className="w-8 h-8 mr-3 text-blue-600" />
            Dashboard de Auditoria
          </h2>
          <p className="text-gray-600 mt-2">
            Monitoramento e análise de atividades do sistema
          </p>
        </div>
        <div className="flex space-x-3 mt-4 sm:mt-0">
          <button
            onClick={loadDashboardData}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <RefreshCw className="w-4 h-4 mr-2" />
            Atualizar
          </button>
          <button
            onClick={handleExportLogs}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <Download className="w-4 h-4 mr-2" />
            Exportar
          </button>
        </div>
      </div>

      {/* Métricas Resumidas */}
      {metrics && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Activity className="w-8 h-8 text-blue-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Total de Eventos</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.total_events}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <AlertTriangle className="w-8 h-8 text-red-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Eventos Suspeitos</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.suspicious_events}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Users className="w-8 h-8 text-green-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Usuários Ativos</p>
                <p className="text-2xl font-bold text-gray-900">{userStats.length}</p>
              </div>
            </div>
          </div>

          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <div className="flex items-center">
              <Clock className="w-8 h-8 text-purple-600" />
              <div className="ml-4">
                <p className="text-sm font-medium text-gray-600">Tempo Médio (ms)</p>
                <p className="text-2xl font-bold text-gray-900">{metrics.avg_response_time_ms?.toFixed(1) || 'N/A'}</p>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="border-b border-gray-200">
        <nav className="-mb-px flex space-x-8">
          {[
            { id: 'overview', label: 'Visão Geral', icon: BarChart3 },
            { id: 'logs', label: 'Logs', icon: Activity },
            { id: 'alerts', label: 'Alertas', icon: Bell },
            { id: 'users', label: 'Usuários', icon: Users }
          ].map(tab => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id as any)}
              className={`flex items-center py-2 px-1 border-b-2 font-medium text-sm ${
                activeTab === tab.id
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              <tab.icon className="w-4 h-4 mr-2" />
              {tab.label}
            </button>
          ))}
        </nav>
      </div>

      {/* Conteúdo das Tabs */}
      {activeTab === 'overview' && (
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Gráfico de Severidade */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <ReactECharts option={getMetricsChartOptions()} style={{ height: '300px' }} />
          </div>

          {/* Gráfico de Tendências */}
          <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
            <ReactECharts option={getTrendsChartOptions()} style={{ height: '300px' }} />
          </div>
        </div>
      )}

      {activeTab === 'logs' && (
        <div className="space-y-4">
          {/* Filtros */}
          <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
                <input
                  type="text"
                  placeholder="Buscar logs..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                />
              </div>

              <select
                value={selectedSeverity}
                onChange={(e) => setSelectedSeverity(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas as severidades</option>
                <option value="LOW">Baixa</option>
                <option value="MEDIUM">Média</option>
                <option value="HIGH">Alta</option>
                <option value="CRITICAL">Crítica</option>
              </select>

              <select
                value={selectedAction}
                onChange={(e) => setSelectedAction(e.target.value)}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Todas as ações</option>
                <option value="CREATE">Criar</option>
                <option value="READ">Ler</option>
                <option value="UPDATE">Atualizar</option>
                <option value="DELETE">Excluir</option>
                <option value="LOGIN">Login</option>
                <option value="EXPORT">Exportar</option>
              </select>

              <input
                type="date"
                value={filter.start_date?.split('T')[0]}
                onChange={(e) => setFilter(prev => ({ ...prev, start_date: e.target.value + 'T00:00:00.000Z' }))}
                className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              />
            </div>
          </div>

          {/* Lista de Logs */}
          <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
            <div className="overflow-x-auto">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Timestamp
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Ação
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Recurso
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Descrição
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Severidade
                    </th>
                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      Status
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {logs.map((log) => (
                    <tr key={log.id} className={log.is_suspicious ? 'bg-red-50' : ''}>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {new Date(log.timestamp).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {log.action}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                        {log.resource_type}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-900 max-w-xs truncate">
                        {log.description}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(log.severity)}`}>
                          {log.severity}
                        </span>
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap">
                        <span className={`text-sm font-medium ${getStatusColor(log.status)}`}>
                          {log.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {activeTab === 'alerts' && (
        <div className="space-y-4">
          {alerts.length === 0 ? (
            <div className="bg-white p-8 rounded-lg shadow-sm border border-gray-200 text-center">
              <Bell className="w-12 h-12 text-gray-400 mx-auto mb-4" />
              <p className="text-gray-600">Nenhum alerta encontrado</p>
            </div>
          ) : (
            alerts.map((alert) => (
              <div key={alert.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center">
                      <AlertTriangle className={`w-5 h-5 mr-2 ${
                        alert.severity === 'CRITICAL' ? 'text-red-600' :
                        alert.severity === 'HIGH' ? 'text-orange-600' :
                        alert.severity === 'MEDIUM' ? 'text-yellow-600' :
                        'text-blue-600'
                      }`} />
                      <h3 className="text-lg font-medium text-gray-900">{alert.title}</h3>
                      <span className={`ml-2 inline-flex px-2 py-1 text-xs font-medium rounded-full ${getSeverityColor(alert.severity)}`}>
                        {alert.severity}
                      </span>
                    </div>
                    <p className="mt-2 text-gray-600">{alert.message}</p>
                    <p className="mt-1 text-sm text-gray-500">
                      {new Date(alert.triggered_at).toLocaleString()}
                    </p>
                  </div>
                  <div className="flex space-x-2 ml-4">
                    {alert.status === 'OPEN' && (
                      <>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'INVESTIGATING')}
                          className="flex items-center px-3 py-1 bg-yellow-600 text-white text-sm rounded hover:bg-yellow-700"
                        >
                          <Eye className="w-4 h-4 mr-1" />
                          Investigar
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'RESOLVED')}
                          className="flex items-center px-3 py-1 bg-green-600 text-white text-sm rounded hover:bg-green-700"
                        >
                          <CheckCircle className="w-4 h-4 mr-1" />
                          Resolver
                        </button>
                        <button
                          onClick={() => handleAlertAction(alert.id, 'FALSE_POSITIVE')}
                          className="flex items-center px-3 py-1 bg-gray-600 text-white text-sm rounded hover:bg-gray-700"
                        >
                          <XCircle className="w-4 h-4 mr-1" />
                          Falso Positivo
                        </button>
                      </>
                    )}
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      )}

      {activeTab === 'users' && (
        <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Usuário
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total de Ações
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações Suspeitas
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Última Atividade
                  </th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Ações Principais
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {userStats.map((stat) => (
                  <tr key={stat.userId}>
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                      {stat.userId}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.totalActions}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      <span className={stat.suspiciousActions > 0 ? 'text-red-600 font-medium' : 'text-gray-600'}>
                        {stat.suspiciousActions}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {stat.lastActivity ? new Date(stat.lastActivity).toLocaleString() : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                      {Object.entries(stat.actionsByType)
                        .sort(([,a], [,b]) => (b as number) - (a as number))
                        .slice(0, 3)
                        .map(([action, count]) => `${action}(${count})`)
                        .join(', ')}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
};

export default AuditoriaDashboard;