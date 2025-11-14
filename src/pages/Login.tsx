// src/pages/Login.tsx
import { useEffect } from 'react';
import { Button, Card, Form, Input, Typography, message } from 'antd';
import { LockOutlined, UserOutlined } from '@ant-design/icons';
import { useNavigate } from 'react-router-dom';
import { isAuthenticated, login } from '../utils/auth';
import logo from '../assets/logo.png';

export default function Login() {
  const navigate = useNavigate();

  useEffect(() => {
    if (isAuthenticated()) {
      navigate('/', { replace: true });
    }
  }, [navigate]);

  const onFinish = (values: { username: string; password: string }) => {
    const ok = login(values.username, values.password);
    if (ok) {
      message.success('欢迎使用aegisdb运维面板');
      navigate('/', { replace: true });
    } else {
      message.error('账号或密码错误（提示：admin / 12345）');
    }
  };

  return (
    <div
      style={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'linear-gradient(135deg, #f5f7fb 0%, #eef2f7 100%)'
      }}
    >
      <Card
        style={{
          width: 380,
          borderRadius: 16,
          boxShadow: '0 10px 30px rgba(15, 23, 42, 0.08)'
        }}
        bordered={false}
      >
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <img
            src={logo}
            alt="AegisDB"
            style={{
              width: 64,
              height: 64,
              objectFit: 'contain',
              borderRadius: 12,
              boxShadow: '0 2px 8px rgba(15, 23, 42, 0.08)'
            }}
          />
        </div>
        <Typography.Title level={3} style={{ textAlign: 'center', marginBottom: 12 }}>
          AegisDB 运维面板
        </Typography.Title>
        <Typography.Paragraph style={{ textAlign: 'center', color: '#64748b', marginBottom: 24 }}>
          登录以继续
        </Typography.Paragraph>
        <Form
          name="login"
          initialValues={{ username: 'admin', password: '12345' }}
          onFinish={onFinish}
          layout="vertical"
        >
          <Form.Item name="username" rules={[{ required: true, message: '请输入用户名' }]}>
            <Input size="large" prefix={<UserOutlined />} placeholder="用户名" />
          </Form.Item>
          <Form.Item name="password" rules={[{ required: true, message: '请输入密码' }]}>
            <Input.Password size="large" prefix={<LockOutlined />} placeholder="密码" />
          </Form.Item>
          <Form.Item>
            <Button type="primary" htmlType="submit" size="large" block>
              登录
            </Button>
          </Form.Item>
        </Form>
      </Card>
    </div>
  );
}