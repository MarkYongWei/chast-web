"use client";

import { useState, useRef } from "react";
import { apiService } from "../../services/api";

interface ImportTrainingModalProps {
  onClose: (dataImported: boolean) => void;
}

export default function ImportTrainingModal({ onClose }: ImportTrainingModalProps) {
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [fileName, setFileName] = useState("");
  const [importing, setImporting] = useState(false);
  const [importProgress, setImportProgress] = useState(0);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 处理文件选择
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.name.endsWith('.xlsx') || file.name.endsWith('.xls') || file.name.endsWith('.csv')) {
        setFileName(file.name);
        setError("");
      } else {
        setError("请上传Excel或CSV文件(.xlsx, .xls, .csv)");
        setFileName("");
        if (fileInputRef.current) {
          fileInputRef.current.value = "";
        }
      }
    }
  };

  // 触发文件选择
  const triggerFileInput = () => {
    if (fileInputRef.current) {
      fileInputRef.current.click();
    }
  };

  // 提交导入请求
  const handleImport = async () => {
    if (!fileName) {
      setError("请选择要导入的文件");
      return;
    }

    setImporting(true);
    setIsSubmitting(true);
    setError("");
    setSuccess("");

    try {
      const file = fileInputRef.current?.files?.[0];
      if (!file) {
        throw new Error("未找到文件");
      }

      // 模拟进度
      const progressInterval = setInterval(() => {
        setImportProgress(prev => {
          const next = prev + 5;
          return next > 90 ? 90 : next;
        });
      }, 300);

      // 创建FormData对象
      const formData = new FormData();
      formData.append('file', file);

      try {
        // 调用API服务进行导入
        const response = await apiService.importTrainingData(formData);
        
        clearInterval(progressInterval);
        setImportProgress(100);

        if (response && response.success) {
          setSuccess(`成功导入${response.count || '多条'}训练数据`);
          setTimeout(() => {
            onClose(true);
          }, 2000);
        } else {
          throw new Error(response?.message || "导入失败");
        }
      } catch (apiError: any) {
        clearInterval(progressInterval);
        
        // 处理特定的API错误
        if (apiError.response?.status === 405) {
          console.warn("API端点不支持当前请求方法，可能是服务器配置问题");
          setError("导入功能暂时不可用，请联系管理员 (错误码: 405)");
        } else if (apiError.response?.status === 413) {
          setError("文件过大，请选择小于10MB的文件");
        } else if (apiError.response?.status === 400) {
          setError(apiError.response?.data?.message || "文件格式错误，请确保使用正确的模板");
        } else if (apiError.message.includes('Network Error')) {
          setError("网络连接失败，请检查API服务是否在线");
        } else {
          throw apiError; // 重新抛出其他错误，让外层catch处理
        }
      }
    } catch (error: any) {
      console.error("导入训练数据失败:", error);
      setError(error.message || "导入失败，请重试");
      setImportProgress(0);
    } finally {
      setIsSubmitting(false);
    }
  };

  // 生成CSV模板并下载
  const generateAndDownloadTemplate = () => {
    // CSV模板内容
    const csvContent = 
`question,content,type
查询岗位信息表下的所有信息,SELECT * FROM \`abc_t_gx_gwxx\`;,sql
,岗位信息表 is abc_t_gx_gwxx,documentation
,CREATE TABLE table_name (...),ddl
如何查询用户表中的所有数据？,SELECT * FROM user_table;,solution`;

    // 创建Blob对象
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    
    // 创建下载链接并触发下载
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    
    link.setAttribute('href', url);
    link.setAttribute('download', 'template.csv');
    link.style.visibility = 'hidden';
    
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 p-0 shadow-xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800">批量导入训练数据</h2>
          <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-2">选择Excel文件</h3>
            <p className="text-gray-600 mb-4">
              请选择要导入的Excel文件(.xlsx, .xls)或CSV文件(.csv)。文件应包含以下列：
            </p>
            <ul className="list-disc pl-5 mb-4 text-gray-600 text-sm">
              <li>问题（问题列，SQL类型和解题步骤类型必填）</li>
              <li>内容（内容列，所有类型必填）</li>
              <li>类型（训练数据类型列，可选值：sql, ddl, documentation, solution）</li>
            </ul>

            {/* 文件上传区域 */}
            <div 
              onClick={triggerFileInput}
              className="border-2 border-dashed border-gray-300 rounded-lg p-6 flex flex-col items-center justify-center cursor-pointer hover:bg-gray-50"
            >
              <input 
                type="file" 
                ref={fileInputRef}
                onChange={handleFileChange}
                className="hidden"
                accept=".xlsx,.xls,.csv"
              />
              <svg className="w-10 h-10 text-gray-400 mb-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M9 19l3 3m0 0l3-3m-3 3V10" />
              </svg>
              <p className="text-gray-600 mb-1">点击选择文件或拖放文件至此</p>
              <p className="text-gray-500 text-sm">支持 .xlsx, .xls, .csv 格式</p>
            </div>

            {/* 已选择文件显示 */}
            {fileName && (
              <div className="mt-4 p-3 bg-blue-50 rounded-md flex items-center">
                <svg className="w-5 h-5 text-blue-500 mr-2" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                </svg>
                <span className="text-blue-700">{fileName}</span>
              </div>
            )}
            
            {/* 导入进度 */}
            {importing && (
              <div className="mt-4">
                <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                  <div 
                    className="bg-blue-500 h-2.5 rounded-full transition-all duration-300" 
                    style={{ width: `${importProgress}%` }}
                  ></div>
                </div>
                <p className="text-gray-600 text-sm">导入中，请稍候... {importProgress}%</p>
              </div>
            )}

            {/* 错误提示 */}
            {error && (
              <div className="mt-4 p-3 bg-red-50 rounded-md text-red-600 text-sm">
                <svg className="w-5 h-5 text-red-500 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                {error}
              </div>
            )}

            {/* 成功提示 */}
            {success && (
              <div className="mt-4 p-3 bg-green-50 rounded-md text-green-600 text-sm">
                <svg className="w-5 h-5 text-green-500 inline-block mr-1" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                </svg>
                {success}
              </div>
            )}
          </div>

          <div className="flex justify-end">
            <button
              onClick={() => onClose(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
              disabled={isSubmitting}
            >
              取消
            </button>
            <button
              onClick={handleImport}
              disabled={isSubmitting || !fileName}
              className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 flex items-center ${
                (isSubmitting || !fileName) ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-white" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  导入中...
                </>
              ) : (
                "开始导入"
              )}
            </button>
          </div>

          <div className="mt-6 p-4 border border-gray-200 rounded-md bg-gray-50">
            <h4 className="text-md font-medium text-gray-700 mb-2">Excel模板格式示例：</h4>
            <div className="overflow-x-auto">
              <table className="min-w-full border border-gray-200">
                <thead>
                  <tr className="bg-gray-100">
                    <th className="px-4 py-2 border text-left">question</th>
                    <th className="px-4 py-2 border text-left">content</th>
                    <th className="px-4 py-2 border text-left">type</th>
                  </tr>
                </thead>
                <tbody>
                  <tr>
                    <td className="px-4 py-2 border">查询岗位信息表下的所有信息</td>
                    <td className="px-4 py-2 border">SELECT * FROM `abc_t_gx_gwxx`;</td>
                    <td className="px-4 py-2 border">sql</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border"></td>
                    <td className="px-4 py-2 border">岗位信息表 is abc_t_gx_gwxx</td>
                    <td className="px-4 py-2 border">documentation</td>
                  </tr>
                  <tr>
                    <td className="px-4 py-2 border"></td>
                    <td className="px-4 py-2 border">CREATE TABLE table_name (...)</td>
                    <td className="px-4 py-2 border">ddl</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="mt-2 text-gray-500 text-sm">
              <p>点击<button onClick={generateAndDownloadTemplate} className="text-blue-500 underline border-none bg-transparent p-0 cursor-pointer">下载模板</button>获取CSV导入模板</p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
} 