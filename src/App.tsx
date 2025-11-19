import './App.css';
import Logo from './assets/logo.png';
import type { ReactNode } from 'react';
import { Layout, Menu, Dropdown } from 'antd';
import { Routes, Route, Link, Navigate, useLocation, useNavigate } from 'react-router-dom';
import {
  AppstoreOutlined,
  HddOutlined,
  DeploymentUnitOutlined,
  LineChartOutlined,
  SettingOutlined,
  FileSearchOutlined,
  RobotOutlined,
  SwapOutlined,
} from '@ant-design/icons';
import { isAuthenticated, logout, getUser } from './utils/auth';
import Login from './pages/Login';
import {
  ClusterOverview,
  Nodes,
  StorageMetrics,
  DistributedMgmt,
  NetworkConnections,
  BizMetrics,
  AlertsNotifications,
  ConfigMgmt,
  LogsAudit,
  AIPanel,
  Graph,
  DataMigration,
  Settings,
} from './pages';

const { Sider, Content } = Layout;

 function PrivateRoute({ children }: { children: ReactNode }) {
  return isAuthenticated() ? children : <Navigate to="/login" replace />;
}

export default function App() {
  const location = useLocation();
  const navigate = useNavigate();
  const user = getUser();

  if (location.pathname === '/login') {
    return (
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route path="*" element={<Navigate to="/login" replace />} />
      </Routes>
    );
  }

  // 为了高亮选中项，取路径第一段作为 key
  const selectedKey = '/' + (location.pathname.split('/')[1] || '');

  const menuItems = [
    { key: '/overview', icon: <AppstoreOutlined />, label: <Link to="/overview">集群概览</Link> },
    { key: '/storage', icon: <HddOutlined />, label: <Link to="/storage">存储监控</Link> },
    { key: '/distributed', icon: <DeploymentUnitOutlined />, label: <Link to="/distributed">分布式管理</Link> },
    { key: '/biz', icon: <LineChartOutlined />, label: <Link to="/biz">业务统计</Link> },
    { key: '/config', icon: <SettingOutlined />, label: <Link to="/config">配置管理</Link> },
    { key: '/logs', icon: <FileSearchOutlined />, label: <Link to="/logs">日志与审计</Link> },
    { key: '/ai', icon: <RobotOutlined />, label: <Link to="/ai">AI 面板</Link> },
    { key: '/migrate', icon: <SwapOutlined />, label: <Link to="/migrate">数据迁移</Link> },
  ];

  const userMenu = {
    items: [
      {
        key: 'logout',
        label: '退出登录',
        onClick: () => {
          logout();
          navigate('/login', { replace: true });
        },
      },
    ],
  };

  return (
    <PrivateRoute>
      
      <Layout style={{ minHeight: '100vh' }}>
        

      <Sider width={220} className="sider">
  <div className="brand">
    <img src={Logo} alt="logo" className="brand-logo" />
    <div className="brand-title">
      <div className="name">AegisDB Monitor</div>
      <div className="sub">Observability & Ops</div>
    </div>
  </div>

  <div className="brand-version">Version 1.0.0</div>

  <Menu
    theme="dark"
    mode="inline"
    items={menuItems}
    selectedKeys={[selectedKey]}
    className="sider-menu"
  />

  <div className="sider-user">
    <Dropdown
      menu={{
        items: userMenu.items,
      }}
      placement="topLeft"
    >
      <div className="btn">
        {user?.username || 'User'}
      </div>
    </Dropdown>
  </div>

  <div className="sider-settings">
    <div className="btn" onClick={() => navigate('/settings')}>
      <SettingOutlined style={{ marginRight: 8 }} />
      设置
    </div>
  </div>
</Sider>
        <Layout>
          <Content style={{ margin: 16, background: '#fff', padding: 16 }}>
            <Routes>
              <Route path="/" element={<Navigate to="/overview" replace />} />
              <Route path="/overview" element={<ClusterOverview />} />
              <Route path="/nodes" element={<Nodes />} />
              <Route path="/storage" element={<StorageMetrics />} />
              <Route path="/distributed" element={<DistributedMgmt />} />
              <Route path="/network" element={<NetworkConnections />} />
              <Route path="/biz" element={<BizMetrics />} />
              <Route path="/alerts" element={<AlertsNotifications />} />
              <Route path="/config" element={<ConfigMgmt />} />
              <Route path="/logs" element={<LogsAudit />} />
              <Route path="/ai" element={<AIPanel />} />
              <Route path="/ai/graph" element={<Graph />} />
              <Route path="/migrate" element={<DataMigration />} />
              <Route path="/settings" element={<Settings />} />
              <Route path="*" element={<Navigate to="/overview" replace />} />
            </Routes>
          </Content>
        </Layout>
      </Layout>
    </PrivateRoute>
  );
}