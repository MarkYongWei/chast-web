"use client";

import { useState } from "react";
import { apiService } from "../../services/api";

interface AddTrainingModalProps {
  onClose: (dataAdded: boolean) => void;
}

export default function AddTrainingModal({ onClose }: AddTrainingModalProps) {
  const [trainingType, setTrainingType] = useState<"SQL" | "Documentation" | "DDL" | "Solution">("SQL");
  const [sqlContent, setSqlContent] = useState("");
  const [questionContent, setQuestionContent] = useState("");
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState("");

  // 提交训练数据
  const handleSubmit = async () => {
    if (!sqlContent.trim()) {
      setError("请输入" + (
        trainingType === "SQL" ? "SQL" : 
        trainingType === "DDL" ? "DDL" : 
        trainingType === "Solution" ? "答案" : 
        "文档"
      ) + "内容");
      return;
    }

    if ((trainingType === "SQL" || trainingType === "Solution") && !questionContent.trim()) {
      setError("请输入问题描述");
      return;
    }

    setIsSubmitting(true);
    setError("");

    try {
      let response;
      if (trainingType === "SQL") {
        response = await apiService.addTraining({
          question: questionContent,
          sql: sqlContent,
          training_data_type: "sql"
        });
      } else if (trainingType === "DDL") {
        response = await apiService.addTraining({
          question: "",
          ddl: sqlContent,
          training_data_type: "ddl"
        });
      } else if (trainingType === "Solution") {
        response = await apiService.addTraining({
          question: questionContent,
          content: sqlContent,
          training_data_type: "solution"
        });
      } else {
        response = await apiService.addTraining({
          question: "",
          documentation: sqlContent,
          training_data_type: "documentation"
        });
      }

      if (response.id) {
        onClose(true);
      } else {
        setError("添加失败，请重试");
      }
    } catch (error: any) {
      console.error("添加训练数据失败:", error);
      setError(error.message || "添加失败，请重试");
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full mx-4 p-0 shadow-xl overflow-hidden">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-2xl font-semibold text-gray-800">添加训练数据</h2>
          <button onClick={() => onClose(false)} className="text-gray-400 hover:text-gray-600">
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <div className="p-6">
          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-2">训练数据类型</h3>
            <div className="space-y-2">
              <label className="flex items-center">
                <input
                  type="radio"
                  name="trainingType"
                  checked={trainingType === "SQL"}
                  onChange={() => setTrainingType("SQL")}
                  className="h-4 w-4 text-blue-500"
                />
                <span className="ml-2 block text-gray-700">
                  <span className="font-medium">SQL</span>
                  <span className="block text-sm text-gray-500">
                    这可以是任何有效的SQL语句。SQL越多越好。
                  </span>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="trainingType"
                  checked={trainingType === "DDL"}
                  onChange={() => setTrainingType("DDL")}
                  className="h-4 w-4 text-blue-500"
                />
                <span className="ml-2 block text-gray-700">
                  <span className="font-medium">DDL</span>
                  <span className="block text-sm text-gray-500">
                    这些是定义数据库结构的CREATE TABLE语句。
                  </span>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="trainingType"
                  checked={trainingType === "Documentation"}
                  onChange={() => setTrainingType("Documentation")}
                  className="h-4 w-4 text-blue-500"
                />
                <span className="ml-2 block text-gray-700">
                  <span className="font-medium">文档</span>
                  <span className="block text-sm text-gray-500">
                    这可以是任何基于文本的文档。保持内容简短，专注于单一主题。
                  </span>
                </span>
              </label>

              <label className="flex items-center">
                <input
                  type="radio"
                  name="trainingType"
                  checked={trainingType === "Solution"}
                  onChange={() => setTrainingType("Solution")}
                  className="h-4 w-4 text-blue-500"
                />
                <span className="ml-2 block text-gray-700">
                  <span className="font-medium">解题步骤</span>
                  <span className="block text-sm text-gray-500">
                    添加问题和对应的答案。
                  </span>
                </span>
              </label>
            </div>
          </div>

          {(trainingType === "SQL" || trainingType === "Solution") && (
            <div className="mb-6">
              <h3 className="text-lg font-medium text-gray-800 mb-2">问题描述</h3>
              <textarea
                value={questionContent}
                onChange={(e) => setQuestionContent(e.target.value)}
                placeholder={trainingType === "Solution" ? "请输入问题" : "例如：查询所有用户的姓名和邮箱"}
                className="w-full h-20 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-sm text-gray-500 mt-1">
                * {trainingType === "Solution" ? "解题步骤" : "SQL"}类型必须输入相关问题描述
              </p>
            </div>
          )}

          <div className="mb-6">
            <h3 className="text-lg font-medium text-gray-800 mb-2">
              {trainingType === "SQL" && "您的SQL"}
              {trainingType === "DDL" && "您的DDL"}
              {trainingType === "Documentation" && "您的文档"}
              {trainingType === "Solution" && "答案"}
            </h3>
            <textarea
              value={sqlContent}
              onChange={(e) => setSqlContent(e.target.value)}
              placeholder={
                trainingType === "SQL" 
                  ? "SELECT column_1, column_2 FROM table_name;"
                  : trainingType === "DDL"
                  ? "CREATE TABLE table_name (...);"
                  : trainingType === "Solution"
                  ? "请输入答案"
                  : "在此输入文档内容..."
              }
              className="w-full h-32 p-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>

          {error && <p className="text-red-500 text-sm mt-1">{error}</p>}

          <div className="flex justify-end">
            <button
              onClick={() => onClose(false)}
              className="px-4 py-2 border border-gray-300 rounded-md text-gray-700 hover:bg-gray-50 mr-2"
            >
              取消
            </button>
            <button
              onClick={handleSubmit}
              disabled={isSubmitting || !sqlContent.trim() || (trainingType === "SQL" && !questionContent.trim())}
              className={`px-4 py-2 bg-blue-500 text-white rounded-md hover:bg-blue-600 ${
                (isSubmitting || !sqlContent.trim() || (trainingType === "SQL" && !questionContent.trim())) ? "opacity-50 cursor-not-allowed" : ""
              }`}
            >
              {isSubmitting ? "保存中..." : "保存"}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
} 