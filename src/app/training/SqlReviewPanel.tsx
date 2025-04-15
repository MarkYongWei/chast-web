import { useState, useEffect } from 'react';
import { apiService } from '../../services/api';

interface SqlReview {
  id: string;
  question: string;
  sql: string;
  result: any;
  explanation?: string;
  timestamp: string;
  status: 'pending' | 'approved' | 'rejected';
}

export default function SqlReviewPanel() {
  const [reviews, setReviews] = useState<SqlReview[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [expandedItems, setExpandedItems] = useState<string[]>([]);

  // 加载待审核的 SQL
  const loadPendingReviews = async () => {
    setIsLoading(true);
    try {
      const response = await apiService.getPendingSqlReviews();
      setReviews(response.reviews);
    } catch (error) {
      console.error('加载待审核SQL失败:', error);
    } finally {
      setIsLoading(false);
    }
  };

  // 处理审核操作
  const handleReview = async (id: string, approved: boolean) => {
    try {
      await apiService.reviewSql(id, approved);
      // 重新加载列表
      loadPendingReviews();
    } catch (error) {
      console.error('审核操作失败:', error);
    }
  };

  // 切换展开/收起状态
  const toggleExpand = (id: string) => {
    setExpandedItems(prev => 
      prev.includes(id) 
        ? prev.filter(item => item !== id)
        : [...prev, id]
    );
  };

  // 格式化时间
  const formatTimestamp = (timestamp: string) => {
    return new Date(timestamp).toLocaleString('zh-CN', {
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
    });
  };

  // 首次加载时获取数据
  useEffect(() => {
    loadPendingReviews();
  }, []);

  return (
    <div className="container mx-auto">
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-gray-800">SQL审核</h1>
            <p className="text-gray-600 mt-1">审核用户提交的SQL查询，确保其质量和安全性。</p>
          </div>
          <button
            onClick={loadPendingReviews}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg hover:bg-blue-600 flex items-center"
          >
            <svg className="w-4 h-4 mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
            刷新列表
          </button>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center p-8">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-500"></div>
            <span className="ml-2 text-gray-600">加载中...</span>
          </div>
        ) : reviews.length === 0 ? (
          <div className="text-center py-8">
            <p className="text-gray-500">暂无待审核的SQL</p>
          </div>
        ) : (
          <div className="space-y-4">
            {reviews.map(review => (
              <div key={review.id} className="border rounded-lg p-4">
                <div className="flex justify-between items-start mb-4">
                  <div>
                    <h3 className="font-medium text-gray-800">{review.question}</h3>
                    <p className="text-sm text-gray-500 mt-1">
                      提交时间：{formatTimestamp(review.timestamp)}
                    </p>
                  </div>
                  <div className="flex space-x-2">
                    <button
                      onClick={() => handleReview(review.id, true)}
                      className="px-4 py-2 bg-green-500 text-white rounded-md hover:bg-green-600"
                    >
                      通过
                    </button>
                    <button
                      onClick={() => handleReview(review.id, false)}
                      className="px-4 py-2 bg-red-500 text-white rounded-md hover:bg-red-600"
                    >
                      拒绝
                    </button>
                  </div>
                </div>

                <div className="space-y-2">
                  <div>
                    <h4 className="text-sm font-medium text-gray-700">SQL查询</h4>
                    <pre className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto text-sm">
                      {review.sql}
                    </pre>
                  </div>

                  <button
                    onClick={() => toggleExpand(review.id)}
                    className="text-blue-500 text-sm hover:text-blue-700"
                  >
                    {expandedItems.includes(review.id) ? '收起详情' : '查看详情'}
                  </button>

                  {expandedItems.includes(review.id) && (
                    <div className="mt-4 space-y-4">
                      {review.explanation && (
                        <div>
                          <h4 className="text-sm font-medium text-gray-700">SQL解释</h4>
                          <p className="mt-1 text-sm text-gray-600">{review.explanation}</p>
                        </div>
                      )}
                      
                      <div>
                        <h4 className="text-sm font-medium text-gray-700">查询结果</h4>
                        <div className="mt-1 p-2 bg-gray-50 rounded overflow-x-auto">
                          <pre className="text-sm">
                            {JSON.stringify(review.result, null, 2)}
                          </pre>
                        </div>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
} 